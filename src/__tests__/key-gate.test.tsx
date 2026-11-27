import { render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Text } from 'react-native';

import RootLayout from '@/app/_layout';
import usage from '@/features/stocks/api/__fixtures__/usage.json';
import { BASE_URL } from '@/features/stocks/api/client';
import { apiQueue } from '@/features/stocks/api/queue';

let mockStored: string | null = null;
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => mockStored),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => {}),
  hideAsync: jest.fn(async () => {}),
}));
// A stand-in Stack that renders the first screen the guards allow.
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => {
  const React = require('react');
  const Screen = () => null;
  const Protected = ({ guard, children }: { guard: boolean; children: React.ReactNode }) =>
    guard ? children : null;
  const Stack = ({ children }: { children: React.ReactNode }) => {
    const names: string[] = [];
    const walk = (n: React.ReactNode) =>
      React.Children.forEach(n, (c: React.ReactElement<{ name?: string; guard?: boolean; children?: React.ReactNode }>) => {
        if (!c || c.props.guard === false) return;
        if (c.props.name) names.push(c.props.name);
        else walk(c.props.children);
      });
    walk(children);
    const { Text } = require('react-native');
    return <Text testID="routes">{names.join(',')}</Text>;
  };
  Stack.Screen = Screen;
  Stack.Protected = Protected;
  const theme = { dark: false, colors: {} };
  return {
    Stack,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    DarkTheme: { ...theme, dark: true },
    DefaultTheme: theme,
  };
});

/* eslint-enable @typescript-eslint/no-require-imports */

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
void Text;

describe('key gate', () => {
  it('exposes only the key screen with no stored key', async () => {
    mockStored = null;
    await render(<RootLayout />);
    expect((await screen.findByTestId('routes')).props.children).toBe('key');
  });

  it('exposes the list and details with a stored key, and sets the queue limit from usage once', async () => {
    mockStored = 'idk_stored';
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/v1/usage`, () => {
        calls++;
        return HttpResponse.json(usage);
      }),
    );
    const configure = jest.spyOn(apiQueue, 'configure');
    await render(<RootLayout />);
    expect((await screen.findByTestId('routes')).props.children).toBe('key,index,stock/[symbol]');
    await waitFor(() => expect(configure).toHaveBeenCalledWith(expect.objectContaining({ limit: 25 })));
    expect(calls).toBe(1);
  });

  it('still opens the list when the startup usage call fails', async () => {
    mockStored = 'idk_stored';
    server.use(http.get(`${BASE_URL}/v1/usage`, () => HttpResponse.error()));
    await render(<RootLayout />);
    expect((await screen.findByTestId('routes')).props.children).toBe('key,index,stock/[symbol]');
  });
});
