import * as zlib from 'zlib';
import { PassThrough } from 'stream';

export class SalesforceStaticResource {
  public read(res: { body: zlib.Gunzip | PassThrough }): Promise<string> {
    return new Promise((resolve, reject) => {
      let content = '';
      res.body.on('data', (data: Uint8Array) => {
        content += data.toString();
      });
      res.body.on('finish', () => {
        resolve(content);
      });
      res.body.on('error', (err: any) => {
        reject(err);
      });
      res.body.read();
    });
  }
}
