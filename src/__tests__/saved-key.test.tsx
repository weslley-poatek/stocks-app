import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import KeyScreen from '@/app/key';
import usage from '@/features/stocks/api/__fixtures__/usage.json';
import { BASE_URL, createClient } from '@/features/stocks/api/client';
import { KeyProvider, useKey } from '@/features/stocks/key-context';
import { Text } from 'react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), canDismiss: () => true, dismissAll: jest.fn() }) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => 'idk_a1b2OLDFULLKEY'),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStore = require('expo-secure-store');

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

function Probe() {
  const { apiKey, rejected } = useKey();
  return <Text testID="probe">{`${apiKey === null ? 'null' : apiKey.includes('OLD') ? 'old' : 'other'}|${rejected}`}</Text>;
}
async function renderScreen() {
  await render(
    <KeyProvider>
      <KeyScreen />
      <Probe />
    </KeyProvider>,
  );
}
const ok = () => http.get(`${BASE_URL}/v1/usage`, () => HttpResponse.json({ ...usage, role: 'pro' }));

describe('saved key view', () => {
  it('shows prefix, plan and remaining today, never the full key', async () => {
    server.use(ok());
    await renderScreen();
    expect(await screen.findByText('idk_a1b2…')).toBeTruthy();
    expect(screen.getByText('pro')).toBeTruthy();
    expect(screen.getByText('380')).toBeTruthy();
    expect(screen.queryByText(/OLDFULLKEY/)).toBeNull();
  });

  it('shows at most 8 characters of a long key_prefix', async () => {
    const long = 'idk_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7';
    server.use(http.get(`${BASE_URL}/v1/usage`, () => HttpResponse.json({ ...usage, key_prefix: long })));
    await renderScreen();
    expect(await screen.findByText('idk_a1b2…')).toBeTruthy();
    expect(screen.queryByText(/c3d4/)).toBeNull();
  });

  it('removes the key and shows the empty key screen', async () => {
    server.use(ok());
    await renderScreen();
    await fireEvent.press(await screen.findByText('Remove key'));
    expect(await screen.findByText('Paste your API key to load B3 prices.')).toBeTruthy();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(screen.getByTestId('probe').props.children).toBe('null|false');
  });

  it('replaces the key when the new one passes the check', async () => {
    server.use(ok());
    await renderScreen();
    await fireEvent.press(await screen.findByText('Replace key'));
    await fireEvent.changeText(screen.getByLabelText('API key'), 'idk_NEWKEY');
    await fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() =>
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), 'idk_NEWKEY'),
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('keeps the old key when the new one fails the check', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/usage`, ({ request }) =>
        request.headers.get('x-api-key') === 'idk_NEWKEY'
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json(usage),
      ),
    );
    await renderScreen();
    await fireEvent.press(await screen.findByText('Replace key'));
    await fireEvent.changeText(screen.getByLabelText('API key'), 'idk_NEWKEY');
    await fireEvent.press(screen.getByLabelText('Continue'));
    expect(await screen.findByText("That key wasn't accepted")).toBeTruthy();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe').props.children).toBe('old|false');
  });

  it('shows "That key was rejected" when a request with the stored key gets 401, keeping the key', async () => {
    server.use(ok());
    await renderScreen();
    await screen.findByText('Replace key');
    server.use(http.get(`${BASE_URL}/v1/tickers/:s/price`, () => new HttpResponse(null, { status: 401 })));
    await expect(createClient('idk_a1b2OLDFULLKEY').price('PETR4')).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(await screen.findByText('That key was rejected')).toBeTruthy();
    expect(screen.getByTestId('probe').props.children).toBe('old|true');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
