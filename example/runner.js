const config = require('config');
const Cryptr = require('cryptr');

const sudoExecutor = require('../src/index.js').sudo;

const cryptr = new Cryptr('MySecretKey');
let dataStr = "";
let RUN_CASE = null;

// ---- TODO: Set the method for retrieving your password here --- //
//RUN_CASE = 0; //"PROMPT_FOR_PASSWORD";
//RUN_CASE = 1; //"RETURN_PLAIN_TEXT_PASSWORD";
//RUN_CASE = 2; //"PROMISE_RESOLVE_PASSWORD_DIRECTLY";
//RUN_CASE = 3; //"PROMISE_RESOLVE_PASSWORD_FROM_CONFIG_FILE";
RUN_CASE = 4; //"PROMISE_RESOLVE_DECRYPTED_PASSWORD";


// Setup a new instance of a sudo command executor
let pingTest = new sudoExecutor({
  finalHandler: () => {
    console.log("[Final Handler]: All Done!");
    console.log("-----------------------");
    console.log(dataStr);
  },
  dataHandler:(data) => {
    dataStr += data;
    console.log(data.toString());
    if(data.toString().match(/\[Y\/n\].$/i)){
      console.log("yes");
      child.stdin.write('y\n');
    }
  },
  isPasswordCached: true
});

// This will apply your selected method of retrieving your password
switch(RUN_CASE){
  case 0:
    // do nothing - run the default
    break;
  case 1:
    pingTest.setPasswordGetter(()=>{
      return "Password123";                   // TODO: Your Password here (not a great idea)
    });
    break;
  case 2:
    pingTest.setPasswordGetter(()=>{
      return new Promise((resolve, reject) =>{
        return resolve("Password123");        // TODO: Your Password here (not a great idea)
      });
    });
    break;
  case 3:
    pingTest.setPasswordGetter(()=>{
      return new Promise((resolve, reject) =>{
        return resolve(config.sudo.pwd);          // TODO: Your Password pulled from config yaml file
      });
    });
    break;
  case 4:
    pingTest.setPasswordGetter(()=> {
      return new Promise((resolve, reject) => {   // TODO: Your password pulled from config yaml (encrypted) then decrypted
        return resolve(config.encrypted.pwd);
      })
      .then((encryptedPwd)=> cryptr.decrypt(encryptedPwd))
      .catch((err)=> new Error(err))
    });
    break;
  default:
    // nothing set, run default
    break;
}

//let child = pingTest.execute([ 'salt', 'node01', 'test.ping', '--out', 'json'], options);
//let child = pingTest.execute([ 'apt-get','install', 'redis-server'], options);
let command = "ls -sla /opt/";
let options = {
  cachePassword: true,
  prompt: 'Password, yo? ',
  spawnOptions: { /* other options for spawn */ }
};

let child = pingTest.execute(command, options);