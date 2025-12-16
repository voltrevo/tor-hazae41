let logged = false;

export function experimentalWarning() {
  if (logged) {
    return;
  }

  console.warn(
    'NOTICE: tor-js is experimental software: https://github.com/voltrevo/tor-js/issues/4'
  );

  logged = true;
}
