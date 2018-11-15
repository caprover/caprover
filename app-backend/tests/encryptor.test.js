const Encryptor = require('../src/utils/Encryptor');

test('Testing Encryptor 1', () => {
    const encryptor = Encryptor.create('8h9h75h7553245235423452345235235235254h75h38');
    let valueToBeEncrypter = 'qq';
    expect(encryptor.decrypt(encryptor.encrypt(valueToBeEncrypter))).toBe(valueToBeEncrypter);
});


test('Testing Encryptor 2', () => {
    const encryptor = Encryptor.create('8h9h75h7553245235423452345235235235254h75h38');
    let valueToBeEncrypter = 'q290852f98nb80nv8m8m bn83vn@ 8098m%#@%$5$@#52q';
    expect(encryptor.decrypt(encryptor.encrypt(valueToBeEncrypter))).toBe(valueToBeEncrypter);
});


test('Testing Encryptor - Key too short', () => {
    let value = 1;
    try {
        const encryptor = Encryptor.create('short');
        value = 0;
    } catch (e) {

    }
    expect(value).toBe(1);
});

