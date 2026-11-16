// A checked-out pg client emits 'error' when its socket dies. pg-pool removes
// its own idle listener at checkout, so unless the caller adds one, Node turns
// the event into an uncaughtException and the process exits with every in-flight
// request (observed live: Neon dropped an idle socket mid-query and the API
// exited). Every checkout goes through this guard, and release removes the
// listener so a pooled client does not accumulate them.
export const guardClientErrors = (client) => {
  if (!client || typeof client.on !== 'function') return client;
  const onError = () => {};
  client.on('error', onError);

  const release = client.release?.bind(client);
  if (release) {
    client.release = (err) => {
      client.off?.('error', onError);
      return release(err);
    };
  }
  return client;
};
