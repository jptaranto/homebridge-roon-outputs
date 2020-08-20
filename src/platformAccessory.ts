import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicEventTypes,
} from 'homebridge';

import { PluginPlatform } from './platform';
import { getVolumioAPIData, volumeClamp, VolumioAPICommandResponse, VolumioAPIState } from './utils';

/**
 * Volumio Speakers Platform Accessory.
 */
export class PluginPlatformAccessory {
  private service: Service;

  // private currentMediaState: CharacteristicValue;

  private targetMediaState: CharacteristicValue;
  private volume: CharacteristicValue;
  private muted: CharacteristicValue;

  constructor(
    private readonly platform: PluginPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // this.currentMediaState = this.getZoneState();
    this.targetMediaState = this.platform.Characteristic.CurrentMediaState.PAUSE;
    this.volume = 0;
    this.muted = false;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Volumio')
      .setCharacteristic(this.platform.Characteristic.Model, 'Zone')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.zone.id);

    this.service =
        this.accessory.getService(this.platform.Service.SmartSpeaker)
        || this.accessory.addService(this.platform.Service.SmartSpeaker);

    // Allows name to show when adding speaker.
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);

    // Event handlers for CurrentMediaState and TargetMediaState Characteristics.
    this.service.getCharacteristic(this.platform.Characteristic.CurrentMediaState)
      .on(CharacteristicEventTypes.GET, this.getCurrentMediaState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetMediaState)
      .on(CharacteristicEventTypes.SET, this.setTargetMediaState.bind(this))
      .on(CharacteristicEventTypes.GET, this.getTargetMediaState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Volume)
      .on(CharacteristicEventTypes.SET, this.setVolume.bind(this))
      .on(CharacteristicEventTypes.GET, this.getVolume.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Mute)
      .on(CharacteristicEventTypes.SET, this.setMute.bind(this))
      .on(CharacteristicEventTypes.GET, this.getMute.bind(this));
  }

  /**
   * Utility method to pull the actual status from the zone.
   */
  async getZoneState(): Promise<VolumioAPIState> {
    const zone = this.accessory.context.zone;
    const defaultData: VolumioAPIState = {
      status: 'stop',
      volume: 0,
      mute: false,
    };
    // If the output/zone doesn't exist for any reason (such as from being grouped, return stopped).
    if (!zone) {
      return defaultData;
    }

    const url = `${zone.host}/api/v1/getState`;
    const { error, data } = await getVolumioAPIData<VolumioAPIState>(url);

    if (error || !data) {
      this.platform.log.error(`Error getting state for Zone: ${zone.name}`);
      this.platform.log.error(`${error}`);
    }

    return data || defaultData;
  }

  /**
   * Get the currentMediaState.
   */
  async getCurrentMediaState(callback: CharacteristicGetCallback) {
    const zoneState = await this.getZoneState();
    const currentMediaState = this.convertVolumioStatusToCharacteristicValue(zoneState.status);
    this.platform.log.debug('Triggered GET CurrentMediaState:', currentMediaState);
    callback(undefined, currentMediaState);
  }

  /**
   * Get the targetMediaState.
   * This doesn't seem to ever be called. Ever...
   */
  getTargetMediaState(callback: CharacteristicGetCallback) {
    const state = this.targetMediaState;
    this.platform.log.debug('Triggered GET CurrentMediaState:', state);
    callback(undefined, state);
  }

  /**
 * Set the targetMediaState.
 * Toggle play/pause
 */
  async setTargetMediaState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.targetMediaState = value;
    this.platform.log.debug('Triggered SET TargetMediaState:', value);

    const zone = this.accessory.context.zone;
    const url = `${zone.host}/api/v1/commands/?cmd=toggle`;
    const { error, data } = await getVolumioAPIData<VolumioAPICommandResponse>(url);

    if (error || !data) {
      this.platform.log.error(`Error setting state for Zone: ${zone.name}`);
      this.platform.log.error(`${error}`);
      callback(error);
      return;
    }

    const state = this.convertVolumioCommandResponseToCharacteristicValue(data);
    callback(undefined, state);
  }

  /**
   * Get the Volume..
   */
  async getVolume(callback: CharacteristicGetCallback) {
    const zoneState = await this.getZoneState();
    this.platform.log.debug('Triggered GET Volume:', zoneState.volume);
    callback(undefined, zoneState.volume);
  }

  /**
   * Set the Volume.
   */
  async setVolume(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.volume = volumeClamp(<number>value);
    this.platform.log.debug('Triggered SET Volume:', this.volume);

    const zone = this.accessory.context.zone;
    const url = `${zone.host}/api/v1/commands/?cmd=volume&volume=${this.volume}`;
    const { error, data } = await getVolumioAPIData<VolumioAPICommandResponse>(url);

    if (error || !data) {
      this.platform.log.error(`Error setting volume for Zone: ${zone.name}`);
      this.platform.log.error(`${error}`);
      callback(error);
      return;
    }

    callback(undefined, this.volume);
  }

  /**
   * Get the Volume..
   */
  async getMute(callback: CharacteristicGetCallback) {
    const zoneState = await this.getZoneState();
    this.platform.log.debug('Triggered GET Mute:', zoneState.mute);
    callback(undefined, zoneState.mute);
  }

  /**
   * Set the Volume.
   */
  async setMute(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const convertedMute = value ? 'mute' : 'unmute';
    this.muted = value;
    this.platform.log.debug('Triggered SET Mute:', this.muted);

    const zone = this.accessory.context.zone;
    const url = `${zone.host}/api/v1/commands/?cmd=volume&volume=${convertedMute}`;
    const { error, data } = await getVolumioAPIData<VolumioAPICommandResponse>(url);

    if (error || !data) {
      this.platform.log.error(`Error setting mute for Zone: ${zone.name}`);
      this.platform.log.error(`${error}`);
      callback(error);
      return;
    }

    callback(undefined, this.muted);
  }

  convertVolumioStatusToCharacteristicValue(status: string): CharacteristicValue {
    // These are the state strings returned by Volumio
    switch (status) {
      case 'play':
        return this.platform.Characteristic.CurrentMediaState.PLAY;
      case 'pause':
        return this.platform.Characteristic.CurrentMediaState.PAUSE;
      case 'stop':
      default:
        return this.platform.Characteristic.CurrentMediaState.STOP;
    }
  }
  
  convertVolumioCommandResponseToCharacteristicValue(data?: VolumioAPICommandResponse): CharacteristicValue {
    let state = this.platform.Characteristic.CurrentMediaState.STOP;

    if (!data) {
      return state;
    }

    // These are the state strings returned by Volumio
    switch (data.response) {
      case 'play Success':
        state = this.platform.Characteristic.CurrentMediaState.PLAY;
        break;
      case 'pause Success':
        state = this.platform.Characteristic.CurrentMediaState.PAUSE;
        break;
      case 'stop Success':
      default:
        state = this.platform.Characteristic.CurrentMediaState.STOP;
        break;
    }

    return state;
  }
}
