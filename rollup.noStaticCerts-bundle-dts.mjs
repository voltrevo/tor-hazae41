import dts from 'rollup-plugin-dts';

export default {
  input: 'dist/TorClient/versions/noStaticCerts.d.ts',
  output: {
    file: 'bundled-builds/noStaticCerts/TorClient.d.ts',
    format: 'es',
  },
  plugins: [dts()],
};
