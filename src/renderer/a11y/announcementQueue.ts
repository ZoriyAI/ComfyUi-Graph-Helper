/** Keep the latest progress message without flooding the reader; state changes can bypass the interval. */
export function announcementQueue(say: (text: string) => void, delay = 1500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = '';
  let spoken = '';
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const flush = () => { clear(); if (latest !== spoken) { spoken = latest; say(latest); } };
  return {
    update(text: string, immediate = false) {
      latest = text;
      if (immediate) flush();
      else if (timer === undefined && latest !== spoken) timer = setTimeout(flush, delay);
    },
    dispose: clear,
  };
}
