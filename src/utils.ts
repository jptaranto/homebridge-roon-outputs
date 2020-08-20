import * as http from 'http';

export async function getVolumioAPIData<T>(url: string): Promise<GetVolumioAPIData<T>> {
  const returnObj: GetVolumioAPIData<T> = {
    error: null,
  };

  const request = new Promise<T>((resolve, reject) => {
    http.get(url, res => {
      const { statusCode } = res;
      const contentType = res.headers['content-type'] || '';

      let error;
      // Any 2xx status code signals a successful response but
      // here we're only checking for 200.
      if (statusCode !== 200) {
        error = new Error('Request Failed.\n' +
          `Status Code: ${statusCode}`);
      } else if (!/^application\/json/.test(contentType)) {
        error = new Error('Invalid content-type.\n' +
          `Expected application/json but received ${contentType}`);
      }
      if (error) {
        // Consume response data to free up memory
        res.resume();
        reject(error);
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => {
        rawData += chunk; 
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(rawData);
          returnObj.data = parsedData;
          resolve(parsedData);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });

  await request.then((data) => {
    returnObj.data = data;
  }).catch((error) => {
    returnObj.error = error;
  });

  return returnObj;
}

export function volumeClamp(volume: number): number {
  volume = Math.round(volume);
  volume = Math.min(volume, 0);
  volume = Math.max(volume, 100);
  return volume;
}

export interface VolumioAPIState {
  status: string;
  position?: number;
  title?: string;
  artist?: string;
  album?: string;
  albumart?: string;
  uri?: string;
  trackType?: string;
  seek?: number;
  duration?: number;
  samplerate?: string;
  bitdepth?: string;
  channels?: number;
  random?: boolean;
  repeat?: boolean;
  repeatSingle?: boolean;
  consume?: boolean;
  volume: number;
  disableVolumeControl?: boolean;
  mute: boolean;
  stream?: string;
  updatedb?: boolean;
  volatile?: boolean;
  service?: string;
}

export interface VolumioAPIZoneState {
  id: string;
  host: string;
  name: string;
  isSelf: boolean;
  state?: VolumioAPIState;
}
export interface VolumioAPIZoneStates {
  zones: VolumioAPIZoneState[];
}

export interface VolumioAPICommandResponse {
  time: number;
  response: string;
}

export interface GetVolumioAPIData<T> {
  error: Error | null;
  data?: T;
}