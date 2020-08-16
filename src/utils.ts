import * as http from 'http';

export function getVolumioAPIData<T>(url: string, logger?): GetVolumioAPIData<T> {
  const returnObj: GetVolumioAPIData<T> = {
    error: null,
  };

  logger.info(`requesting ${url}`);
  http.get(url, res => {
    let rawJSON = '';

    res.on('data', chunk => {
      logger.info(`recieved chunk: ${chunk}`);
      rawJSON += chunk;
    });

    res.on('end', () => {
      try {
        logger.info(`parsing raw json: ${rawJSON}`);
        const parsedJSON = JSON.parse(rawJSON);
        logger.info(`parsed json: ${parsedJSON}`);
        returnObj.data = parsedJSON;
      } catch (err) {
        returnObj.error = err;
      }
    });
  }).on('error', err => {
    logger.info(`http error: ${err}`);
    returnObj.error = err;
  });

  return returnObj;
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
  volume?: number;
  disableVolumeControl?: boolean;
  mute?: boolean;
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