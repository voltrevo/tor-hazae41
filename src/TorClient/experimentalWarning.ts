let logged = false;

export function experimentalWarning() {
  if (logged) {
    return;
  }

  console.warn(
    [
      'NOTICE: tor-js is experimental software.',
      "-> Let us know at https://github.com/voltrevo/tor-js/issues/new if you'd like an audited version.",
    ].join('\n')
  );

  logged = true;
}
