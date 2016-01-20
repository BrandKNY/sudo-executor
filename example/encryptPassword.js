const Cryptr = require('cryptr')
const cryptr = new Cryptr('MySecretKey');

/**
 * Put your password in to encrypt it and copy the string that is console.logged;
 * Add this encrypted string to the .yaml configuration file and it will be decrypted
 * in the runner.js when using the decrypt passwordGetter function for sudo
 */
var encryptedString = cryptr.encrypt('Password123');
console.log(encryptedString);