import { loadHistory } from '../prices';

const mockPrice = jest.fn();
jest.mock('../api/client', () => ({ createClient: () => ({ price: mockPrice }) }));
jest.mock('../history-store', () => ({
  ...jest.requireActual('../history-store'),
  readHistory: jest.fn(async () => undefined),
  writeHistory: jest.fn(async () => {
    throw new Error('disk full');
  }),
}));

describe('loadHistory', () => {
  it('keeps the fetched bars when the file write fails', async () => {
    const bars = [{ timestamp: 1, close: 5, volume: 1 }];
    mockPrice.mockResolvedValue(bars);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(loadHistory('idk_secret', 'PETR4')).resolves.toEqual(bars);
    expect(log).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });
});
