const spawn = require('child_process').spawn;
const read = require('read');
const inpathSync = require('inpath').sync;
const pidof = require('pidof');

const path = process.env['PATH'].split(':');
const sudoBin = inpathSync('sudo', path);

let cachedPassword = null;


class sudo {
  /**
   * The function to run when the command execution triggers the 'data' event
   * @callback DataHandler
   * @param {*} data
   */
  /**
   * The function to run when the command execution triggers the 'finish' event
   * @callback FinalHandler
   */
  /**
   * A function or Promise that returns/resolves with the sudo password;
   * This allows potential to - for example - wire together logic that can
   * retrieve an encrypted password from an external source (e.g. Database)
   * and decrypt it before it is finally passed in as an answer to the
   * underlying password-prompt.
   * @callback PasswordGetter
   */
  /**
   * @param {Object} opts - options to setup this instance of the sudo runner
   * @param {DataHandler} opts.dataHandler - function to process data results
   * @param {FinalHandler} opts.finalHandler - function to run after stream ends
   * @param {PasswordGetter} [opts.passwordGetter] - (optional) Function or Promise that returns/resolves the sudo password
   * @param {Boolean} [opts.isPasswordCached = false] - (optional) should resolved password be cached for possible re-use; defaults to False
     */
  constructor(opts){
    this.setDataHandler(opts.dataHandler);
    this.setFinalHandler(opts.finalHandler);
    !!opts.passwordGetter && this.setPasswordGetter(opts.passwordGetter);
    this._isPasswordCached = !!opts.isPasswordCached;
  };

  /**
   * Execute a command
   * @param cmdStr
   * @param opts
   * @returns {*}
     */
  execute(cmdStr, opts) {
    let command = cmdStr.split(" ");
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
          if(this._passwordGetter){
            new Promise((resolve, reject)=>{
              answer = (cachedPassword) ? cachedPassword : this._passwordGetter();
              if(answer && !(answer instanceof Error)) {
                return resolve(answer);
              } else {
                return reject(new Error("Failed to retrieve password with provided passwordGetter function"));
              }
            }).then((pwd)=>{
                child.stdin.write(pwd + '\n');
            }).catch((err) => {
              throw new Error(err);
            });
          } else {
            // prompt user for password via stdInput (default)
            read({prompt: options.prompt || 'sudo requires your password: ', silent: true}, (error, pwd) => {
              answer = pwd;
              child.stdin.write(answer + '\n');
            });
          }
          if(this._isPasswordCached) {
            _setCachedPassword.call(this, answer);
          }
        }
      });
    });

    function _setCachedPassword(pwd){
      this.setCachedPassword(pwd);
    }

    function _enableEventHandlers(){
      this._child.stdout.on('data', this._dataHandler);
      this._child.stdout.on('finish', this._finalHandler);
    }

    this._child = child;
    _enableEventHandlers.call(this);
    return child;
  }

  /**
   * Set the data handler function explicitly; Usually set w/ constructor options parameter
   * @param {DataHandler} fn
     */
  setDataHandler(fn){
    this._dataHandler = fn;
  }

  /**
   * Set the final handler function explicitly; Usually set w/ constructor options parameter
   * @param {FinalHandler} fn
     */
  setFinalHandler(fn){
    this._finalHandler = fn;
  }

  /**
   * Set the password getter function explicitly; Usually set w/ constructor options parameter
   * @param {PasswordGetter} fn
     */
  setPasswordGetter(fn){
    if(!fn || typeof fn !== 'function'){
      return;
    }
    this._passwordGetter = fn;
  }

  /**
   * Sets the cachedPassword; Only if user enabled caching password w/ constructor option 'isPasswordCached'
   * @param pwd
     */
  setCachedPassword(pwd){
    cachedPassword = pwd;
  }

  /**
   * Clears the cachedPassword reference by setting it to {@type null}
   */
  clearCachedPassword(){
    cachedPassword = null;
  }
}

module.exports = sudo;
