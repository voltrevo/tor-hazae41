import { assert, test } from '../../../../phobos/mod';
import { Name } from './name';

function checkFromTo(x501: string, message?: string) {
  // console.log("aaa", x501)
  // console.log("bbb", Name.tryFromX501(x501).unwrap().tryToX501().unwrap())

  assert(x501 === Name.fromX501OrThrow(x501).toX501OrThrow(), message);
}

test('Name', async () => {
  checkFromTo(`UID=jsmith,DC=example,DC=net`, `X.501 RFC example #1`);
  checkFromTo(
    `OU=Sales+CN=J.  Smith,DC=example,DC=net`,
    `X.501 RFC example #2`
  );
  checkFromTo(
    `CN=James \\"Jim\\" Smith\\, III,DC=example,DC=net`,
    `X.501 RFC example #3`
  );
  checkFromTo(`CN=Before\\0dAfter,DC=example,DC=net`, `X.501 RFC example #4`);
  checkFromTo(`1.3.6.1.4.1.1466.0=#04024869`, `X.501 RFC example #5`);

  assert(
    Name.fromX501OrThrow('CN=Lu\\C4\\8Di\\C4\\87').toX501OrThrow() ===
      'CN=Lučić',
    `utf-8 unescaping`
  );

  checkFromTo(
    `O=Acme Inc.,L=Paris,ST=Île-de-France,C=FR,CN=www.dfjini.com,CN=www.odncfbse.com`,
    `full cert`
  );
});
