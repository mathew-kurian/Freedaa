import python from 'python-shell';

export default async function strDiff(a, b) {
  return new Promise((resolve, reject) => {
    python.run('tdiff.py', {scriptPath: __dirname, args: [a, b]}, (err, res) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(Number((res[0] || '').trim()));
    });
  });
}
