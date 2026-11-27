import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import KeyScreen from '@/app/key';
import usage from '@/features/stocks/api/__fixtures__/usage.json';
import { BASE_URL, createClient } from '@/features/stocks/api/client';
import { KeyProvider } from '@/features/stocks/key-context';

const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
let mockCanDismiss = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    dismissAll: mockDismissAll,
    canDismiss: () => mockCanDismiss,
  }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({})) }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStore = require('expo-secure-store');

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  mockCanDismiss = true;
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

async function renderScreen() {
  await render(
    <KeyProvider>
      <KeyScreen />
    </KeyProvider>,
  );
  await screen.findByText('Connect InvestingData');
}
async function enterKeyAndContinue(key: string) {
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('API key'), key);
  await fireEvent.press(screen.getByLabelText('Continue'));
}
const usageStatus = (status: number) =>
  http.get(`${BASE_URL}/v1/usage`, () => new HttpResponse(null, { status }));

describe('key screen', () => {
  it('shows the title and line on first launch', async () => {
    await renderScreen();
    expect(screen.getByText('Paste your API key to load B3 prices.')).toBeTruthy();
  });

  it('pastes a key, masked until Show is tapped', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('idk_01a2b3c4');
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Paste'));
    const field = screen.getByLabelText('API key');
    await waitFor(() => expect(field.props.value).toBe('idk_01a2b3c4'));
    expect(field.props.secureTextEntry).toBe(true);
    expect(field.props.autoCorrect).toBe(false);
    expect(field.props.autoCapitalize).toBe('none');
    expect(JSON.stringify(field.props.style)).toMatch(/Menlo|monospace/);
    await fireEvent.press(screen.getByLabelText('Show key'));
    expect(screen.getByLabelText('API key').props.secureTextEntry).toBe(false);
  });

  it('saves the key and replaces the route on success', async () => {
    let sent: string | null = null;
    server.use(
      http.get(`${BASE_URL}/v1/usage`, ({ request }) => {
        sent = request.headers.get('x-api-key');
        return HttpResponse.json(usage);
      }),
    );
    await enterKeyAndContinue('idk_test1234');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(sent).toBe('idk_test1234');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), 'idk_test1234');
    // Pushed from the list: the stack is reset first, so there is no way back to the key screen.
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockDismissAll.mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0]);
  });

  it('only replaces when there is nothing to dismiss (first launch)', async () => {
    mockCanDismiss = false;
    server.use(http.get(`${BASE_URL}/v1/usage`, () => HttpResponse.json(usage)));
    await enterKeyAndContinue('idk_test1234');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockDismissAll).not.toHaveBeenCalled();
  });

  it('shows a spinner and disables the field while checking', async () => {
    let release: () => void = () => {};
    server.use(
      http.get(`${BASE_URL}/v1/usage`, async () => {
        await new Promise<void>((r) => (release = r));
        return HttpResponse.json(usage);
      }),
    );
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('API key'), 'idk_test1234');
    // Not awaited: the press settles only once the check does.
    void fireEvent.press(screen.getByLabelText('Continue'));
    expect(await screen.findByTestId('checking-spinner')).toBeTruthy();
    expect(screen.getByLabelText('API key').props.editable).toBe(false);
    release();
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  });

  it('shows "That key wasn\'t accepted" and saves nothing on 401', async () => {
    server.use(usageStatus(401));
    await enterKeyAndContinue('idk_bad');
    expect(await screen.findByText("That key wasn't accepted")).toBeTruthy();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('explains a plan without price data on 403 and saves nothing', async () => {
    server.use(usageStatus(403));
    await enterKeyAndContinue('idk_free');
    expect(await screen.findByText("This key's plan doesn't include price data")).toBeTruthy();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('offers Retry when offline, saves nothing, and Retry can succeed', async () => {
    server.use(http.get(`${BASE_URL}/v1/usage`, () => HttpResponse.error()));
    await enterKeyAndContinue('idk_test1234');
    expect(await screen.findByText("Can't check the key right now")).toBeTruthy();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    server.use(http.get(`${BASE_URL}/v1/usage`, () => HttpResponse.json(usage)));
    await fireEvent.press(screen.getByLabelText('Retry'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('opens the dashboard in the in-app browser', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText("Don't have a key? Get one"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://www.investingdata.com.br/dashboard',
    );
  });

  it('never logs the full key across the flow', async () => {
    const key = 'idk_secretfullkey9999';
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => {}),
    );
    server.use(usageStatus(401));
    await enterKeyAndContinue(key);
    await screen.findByText("That key wasn't accepted");
    server.use(http.get(`${BASE_URL}/v1/usage`, () => HttpResponse.json(usage)));
    await createClient(key).usage();
    await fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const logged = spies.flatMap((s) => s.mock.calls).map((a) => a.map(String).join(' '));
    expect(logged.some((l) => l.includes(key))).toBe(false);
    spies.forEach((s) => s.mockRestore());
  });
});
