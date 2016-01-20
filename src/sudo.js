const spawn = require('child_process').spawn;
const read = require('read');
const inpathSync = require('inpath').sync;
const pidof = require('pidof');

const path = process.env['PATH'].split(':');
const sudoBin = inpathSync('sudo', path);

let cachedPassword = null;


class sudo {
  constructor(opts){
    this._dataHandler = opts.dataHandler;
    this._finalHandler = opts.finalHandler;
    if(opts.customGetPwd){
      if(typeof opts.customGetPwd === 'function'){
        this._customGetPwd = opts.customGetPwd;
      }
    }
    this._isPasswordCached = opts.isPasswordCached || false;
  };

  /**
   * Execute a command
   * @param command
   * @param opts
   * @returns {*}
     */
  execute(command, opts) {
    let prompt = '#node-sudo-passwd#';
    let prompts = 0;

    // -S, --stdin                 read password from standard input
    // -p, --prompt=prompt         use the specified password prompt
    // e.g. sudo -p "password is: " ls /opt/
    let args = ['-S', '-p', prompt];
    args.push.apply(args, command);

    // The binary is the first non-dashed parameter to sudo
    let bin = command.filter((i) => i.indexOf('-') !== 0)[0];

    let options = opts || {};
    let spawnOptions = options.spawnOptions || {};
    spawnOptions.stdio = 'pipe';

    let child = spawn(sudoBin, args, spawnOptions);

    // Wait for the sudo:d binary to start up
    function waitForStartup(err, pid) {
      if (err) {
        throw new Error('Couldn\'t start ' + bin);
      }

      if (pid || child.exitCode !== null) {
        child.emit('started');
      } else {
        setTimeout(() => {
          pidof(bin, waitForStartup);
        }, 100);
      }
    }

    pidof(bin, waitForStartup);

    // FIXME: Remove this handler when the child has successfully started
    child.stderr.on('data',(data) => {
      let lines = data.toString().trim().split('\n');
      let answer;
      lines.forEach((line) => {
        if (line === prompt) {
          if (++prompts > 1) {
            // The previous entry must have been incorrect, since sudo asks again.
            cachedPassword = null;
          }
          if(this._customGetPwd){
            new Promise((resolve, reject)=>{
              answer = (cachedPassword) ? cachedPassword : this._customGetPwd();
              if(answer && !answer instanceof Error) {
                resolve(answer);
              } else {
                reject(new Error("Failed to retrieve password with provided customGetPassword function"));
              }
            }).then((pwd)=>{
                child.stdin.write(pwd + '\n');
            }).catch((err) => {
              throw new Error(err);
            });
          } else {
            read({prompt: options.prompt || 'sudo requires your password: ', silent: true}, (error, pwd) => {
              answer = pwd;
              child.stdin.write(answer + '\n');
            });
          }
          if(this._isPasswordCached) {
            cachedPassword = answer;
          }
        }
      });
    });

    function _enableEventHandlers(){
      this._child.stdout.on('data', this._dataHandler);
      this._child.stdout.on('finish', this._finalHandler);
    }

    this._child = child;
    _enableEventHandlers.call(this);
    return child;
  }
}

module.exports = sudo;
