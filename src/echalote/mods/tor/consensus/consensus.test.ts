import { assert, test } from '@hazae41/phobos';
import { Consensus } from './consensus.js';

const microdesc = `onion-key
-----BEGIN RSA PUBLIC KEY-----
MIGJAoGBALJcqKBDfT41bLkkBvKSMuictvSQjwiV2GUBszYb0zgOZV2D6pfIM6/Z
5oMUXbxVU0qPxvM+80h3AIoMsmsDrl91AWIS1gMPE/kKtyGnA/WaX3RfwkWvYXZz
5Dwg1Hoh2L41yNxml6QlEWEEk+sGh899od1KMYH5WdanNq/4xBNrAgMBAAE=
-----END RSA PUBLIC KEY-----
ntor-onion-key NaEdxqudourIdG2Zhijv+9QSWS8iEsVq6NUExXah7GM
id ed25519 uZ0YqbYpBJ8Ts8lomKs8PRlxPFucUJFayt/pWGilkd0`;

const microdescs = `r c0der AjUfyI0L8G9s3lRSZWZB5hGdvX4 2038-01-01 00:00:00 95.216.20.80 8080 0
a [2a01:4f9:2a:14af::2]:8080
m mkHw/LD1moosjemRD+GqSqXzzK1kOvK3ZwTsCPGJIFs
s Fast Guard Running Stable V2Dir Valid
v Tor 0.4.8.8
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=34000
r rome2 AjV5EbiC8ldnbnWwfs//WIXks0U 2038-01-01 00:00:00 185.146.232.243 9001 0
a [2a06:1700:0:16b::11]:9001
m bqFbVmdtoHQMXRA/w4KtTKXQ5J0otxAnqz+vcX7IWyY
s Exit Fast Running V2Dir Valid
v Tor 0.4.8.8
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=5800
r howlin Ali9rps1FxSwvMDavh15jWYuuog 2038-01-01 00:00:00 45.141.153.214 443 0
m QZQfLsxKhJ3bP1UQzfZc/lAsH5ZdO7eQNnTF+mbNr3E
s Fast Guard HSDir Running Stable V2Dir Valid
v Tor 0.4.8.7
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=72000
r prsv Al3bAX15RgxKP2eV1S/vu1ahM/M 2038-01-01 00:00:00 45.158.77.29 9200 0
a [2a04:ecc0:8:a8:4567:491:0:1]:9200
m sqAO/nlM44Npw8+bvc0xRELEhrwi+VndMBtl7Ix9H1k
s Fast Guard Running Stable V2Dir Valid
v Tor 0.4.8.7
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=25000
r Assange029us AmSPLxNccpaiex9Z0q5O7CXZqHc 2038-01-01 00:00:00 74.48.220.106 9001 0
m wFQ5tyogkqYjeiIPWEs3bViMCwJ0DIdJMJUy3ezLh34
s Fast Running Stable Valid
v Tor 0.4.8.9
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=3500
r middleIsenguard AmVLi5gDd1hgzfLH9xCf9ooTSao 2038-01-01 00:00:00 87.1.222.174 10101 0
m 5G6mtD7rR8gAcA+9vN4L1fPJ+qEtevLfz03AmRHcUXY
s Fast Guard HSDir Running Stable V2Dir Valid
v Tor 0.4.8.7
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=12000
r danon AmxXo9zkiTvDMa0fi6briUvEoPk 2038-01-01 00:00:00 57.128.174.82 3333 0
m nAAEyOnyxzVAAI+1bUYxZY8qCyFwfW8PpMsTTMnnLCY
s Fast Guard HSDir Running Stable V2Dir Valid
v Tor 0.4.7.13
pr Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=12000
r TheBuckeyeNetwork AmyEHFz3r3HRMJO13J1d0tN2Rp4 2038-01-01 00:00:00 174.96.88.128 9001 0
m GoLC/ntpzpO0epvoeQQYHbCYL7q2nGRhDwOV+Bw5U/Y
s Fast HSDir Running Stable V2Dir Valid
v Tor 0.4.7.13
pr Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=170
r b8zsRelay1 AnD0XRqclFMyLdEbk3scAj4SCKs 2038-01-01 00:00:00 66.41.17.62 9001 0
m y96liLQvN7gF48flHgTRuFF/4+U/30BviSBNVwaD5oY
s Fast Running V2Dir Valid
v Tor 0.4.8.9
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=480
r zagreus AnQPRy0dpcG3dHXxiUD+efFa9Lg 2038-01-01 00:00:00 81.169.222.158 9001 0
a [2a01:238:4224:8d00:f3a9:25e6:4cb6:f3d]:9001
m 5IDAqY97qJ5MNlVqY3+0XK803WuzCAECy59qTLNRHIw
s Fast HSDir Running Stable V2Dir Valid
v Tor 0.4.8.8
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=540
r Digitalcourage4ipeb An51yS8SMa5fe9ThU2aW/jBAxGA 2038-01-01 00:00:00 185.220.102.244 993 0
a [2a0b:f4c1:2::244]:993
m 6zzVgC32SNZtYIvm7TgCe6jGtehwEcwbLb6CKsEnVy8
s Exit Fast Guard HSDir Running Stable V2Dir Valid
v Tor 0.4.8.9
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=33000
r Kanellos AovvSoFXgoa6oTUsc+Rgm5kVxoc 2038-01-01 00:00:00 146.0.36.87 9007 0
m bd1Ctt4aYI8YFvg76X7e68iKkf5mSUW+qEnaVbzdpPA
s Fast Guard HSDir Running Stable V2Dir Valid
v Tor 0.4.8.9
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=24000
r changeme AqDY3fTaTmAcHGYUO7DIoPLzyFc 2038-01-01 00:00:00 157.90.77.166 9001 0
m KBBrw07FttX6hBApwJRMKnMUiAPuOjT0utAX2q7XEi8
s Fast Guard HSDir Running Stable V2Dir Valid
v Tor 0.4.8.8
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=21000
r LV426 AqWUEt5YmgCTaby/geVvDWSztGQ 2038-01-01 00:00:00 141.147.54.226 9001 0
a [2603:c020:8012:8b01:afef:180d:1d92:d3d4]:9001
m 8LiidxTziH538pVjEtJ+x7G6+Xe8lSLjUwYjtAbsk/s
s Fast Running Stable V2Dir Valid
v Tor 0.4.8.9
pr Conflux=1 Cons=1-2 Desc=1-2 DirCache=2 FlowCtrl=1-2 HSDir=2 HSIntro=4-5 HSRend=1-2 Link=1-5 LinkAuth=1,3 Microdesc=1-2 Padding=2 Relay=1-4
w Bandwidth=510
directory-footer
bandwidth-weights Wbd=0 Wbe=0 Wbg=4096 Wbm=10000 Wdb=10000 Web=10000 Wed=10000 Wee=10000 Weg=10000 Wem=10000 Wgb=10000 Wgd=0 Wgg=5904 Wgm=5904 Wmb=10000 Wmd=0 Wme=0 Wmg=4096 Wmm=10000
directory-signature sha256 0232AF901C31A04EE9848595AF9BB7620D4C5B2E DBC44B8640348CF9B2C152A6A09173810DF2C3B2
-----BEGIN SIGNATURE-----
dGVzdCBzaWduYXR1cmUgZHVtbXkgZGF0YSBmb3IgdGVzdGluZyBwdXJwb3NlcyBv
bmx5IHRoaXMgaXMgbm90IGEgcmVhbCBzaWduYXR1cmUganVzdCBwbGFjZWhvbGRl
ciBkYXRhIHRvIG1ha2UgdGhlIHBhcnNlciBoYXBweSBhbmQgYWxsb3cgdGhlIHRl
c3RzIHRvIHJ1biBwcm9wZXJseSB3aXRob3V0IG5lZWRpbmcgYWN0dWFsIHZhbGlk
Y3J5cHRvZ3JhcGhpYyBzaWduYXR1cmVzIGZyb20gcmVhbCBhdXRob3JpdGllcyBp
biB0aGUgdG9yIG5ldHdvcmsgdGhpcyBpcyBqdXN0IGZvciBwYXJzaW5nIHRlc3Rz
-----END SIGNATURE-----`;

test('microdesc', async () => {
  const result = Consensus.Microdesc.parseOrThrow(microdesc);

  assert(Array.isArray(result), 'Result should be an array');
  assert(result.length === 1, 'Should parse one microdesc');
  assert(result[0].onionKey !== undefined, 'Should have onionKey');
  assert(result[0].ntorOnionKey !== undefined, 'Should have ntorOnionKey');
  assert(result[0].idEd25519 !== undefined, 'Should have idEd25519');
  assert(
    result[0].ntorOnionKey === 'NaEdxqudourIdG2Zhijv+9QSWS8iEsVq6NUExXah7GM',
    'ntorOnionKey should match expected value'
  );
  assert(
    result[0].idEd25519 === 'uZ0YqbYpBJ8Ts8lomKs8PRlxPFucUJFayt/pWGilkd0',
    'idEd25519 should match expected value'
  );
});

test('microdescs', async () => {
  const result = await Consensus.parseOrThrow(microdescs);

  assert(result.authorities !== undefined, 'Should have authorities array');
  assert(result.microdescs !== undefined, 'Should have microdescs array');
  assert(Array.isArray(result.microdescs), 'microdescs should be an array');
  assert(result.microdescs.length === 14, 'Should parse 14 microdescs');

  // Check first microdesc
  const first = result.microdescs[0];
  assert(
    first.nickname === 'c0der',
    'First microdesc nickname should be c0der'
  );
  assert(
    first.hostname === '95.216.20.80',
    'First microdesc hostname should match'
  );
  assert(first.orport === 8080, 'First microdesc orport should be 8080');
  assert(
    first.ipv6 === '[2a01:4f9:2a:14af::2]:8080',
    'First microdesc should have IPv6 address'
  );
  assert(Array.isArray(first.flags), 'Flags should be an array');
  assert(first.flags.includes('Fast'), 'Should have Fast flag');
  assert(first.flags.includes('Guard'), 'Should have Guard flag');
  assert(first.version === 'Tor 0.4.8.8', 'Version should match');

  // Check that all microdescs have required fields
  for (const microdesc of result.microdescs) {
    assert(
      microdesc.nickname !== undefined,
      'Each microdesc should have a nickname'
    );
    assert(
      microdesc.identity !== undefined,
      'Each microdesc should have an identity'
    );
    assert(
      microdesc.hostname !== undefined,
      'Each microdesc should have a hostname'
    );
    assert(
      typeof microdesc.orport === 'number',
      'Each microdesc orport should be a number'
    );
  }
});
