import { createHash } from 'node:crypto';

const privateKey = 'a4825234f4bae72a0be04eafe9e8e2bada209255';
const data = 'eyJwdWJsaWNfa2V5IjoiaTAwMDAwMDAwIiwidmVyc2lvbiI6NywiYWN0aW9uIjoicGF5IiwiYW1vdW50IjoiMyIsImN1cnJlbmN5IjoiVUFIIiwiZGVzY3JpcHRpb24iOiJ0ZXN0Iiwib3JkZXJfaWQiOiIwMDAwMDEifQ==';
const expected = '0adgJ8F2Ds5HCVkcz4AlmdLMRoIJf7IxsL3QmeFRz/s=';
const actual = createHash('sha3-256').update(privateKey + data + privateKey).digest('base64');
if (actual !== expected) {
  console.error('FAIL LiqPay signature fixture', { actual, expected });
  process.exit(1);
}
console.log('PASS LiqPay SHA3-256 signature fixture');
