import dts from 'rollup-plugin-dts';

export default {
  input: 'dist/TorClient/versions/singleton.d.ts',
  output: {
    file: 'dist-singleton/tor.d.ts',
    format: 'es',
  },
  plugins: [dts()],
};
