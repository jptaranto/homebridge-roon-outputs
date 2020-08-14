import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicGetCallback,
  CharacteristicEventTypes,
} from 'homebridge';

import { PluginPlatform } from './platform';
import { getVolumioAPIData, VolumioAPICommandResponse, VolumioAPIState } from './utils';

/**
 * Roon Outputs Platform Accessory.
 */
export class PluginPlatformAccessory {
  private service: Service;

  private currentMediaState: CharacteristicValue;

  private targetMediaState: CharacteristicValue;

  constructor(
    private readonly platform: PluginPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.currentMediaState = this.getZoneState();
    this.targetMediaState = this.platform.Characteristic.CurrentMediaState.PAUSE;

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

    // this.service.getCharacteristic(this.platform.Characteristic.Volume)
    //   .on(CharacteristicEventTypes.SET, this.setVolume.bind(this))
    //   .on(CharacteristicEventTypes.GET, this.getVolume.bind(this));

    // This will do its best to keep the actual outputs status up to date with Homekit.
    // setInterval(() => {
    //   this.currentMediaState = this.getZoneState();
    //   this.service.getCharacteristic(this.platform.Characteristic.CurrentMediaState).updateValue(this.currentMediaState);
    // }, 3000);
  }

  /**
   * Utility method to pull the actual status from the zone.
   */
  getZoneState() {
    const zone = this.accessory.context.zone;
    
    // If the output/zone doesn't exist for any reason (such as from being grouped, return stopped).
    if (!zone) {
      return this.platform.Characteristic.CurrentMediaState.STOP;
    }

    const url = `${zone.host}/api/v1/getState`;
    const { error, data } = getVolumioAPIData<VolumioAPIState>(url);

    if (error || !data) {
      this.platform.log.error(`Error getting state for Zone: ${zone.name}`);
      this.platform.log.error(`${error}`);
    }

    return this.convertVolumioStateToCharacteristicValue(data);
  }

  /**
   * Get the currentMediaState.
   */
  getCurrentMediaState(callback: CharacteristicGetCallback) {
    this.currentMediaState = this.getZoneState();
    this.platform.log.debug('Triggered GET CurrentMediaState:', this.currentMediaState);
    callback(undefined, this.currentMediaState);
  }

  /**
   * Set the targetMediaState.
   * Toggle play/pause
   */
  setTargetMediaState(value, callback: CharacteristicGetCallback) {
    this.targetMediaState = value;
    this.platform.log.debug('Triggered SET TargetMediaState:', value);

    const zone = this.accessory.context.zone;
    const url = `${zone.host}/api/v1/commands/?cmd=toggle`;
    const { error, data } = getVolumioAPIData<VolumioAPICommandResponse>(url);

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
   * Get the targetMediaState.
   * This doesn't seem to ever be called. Ever...
   */
  getTargetMediaState(callback: CharacteristicGetCallback) {
    const state = this.targetMediaState;
    this.platform.log.debug('Triggered GET CurrentMediaState:', state);
    callback(undefined, state);
  }

  // /**
  //  * Get the Volume.
  //  * This doesn't seem to ever be called. Ever...
  //  */
  // setVolume(value, callback: CharacteristicGetCallback) {
  //   this.targetMediaState = value;
  //   this.platform.log.debug('Triggered SET TargetMediaState:', value);

  //   const zone = this.accessory.context.zone;
  //   const url = `${zone.host}/api/v1/commands/?cmd=toggle`;
  //   const { error, data } = getVolumioAPIData<VolumioAPICommandResponse>(url);

  //   if (error || !data) {
  //     this.platform.log.error(`Error setting state for Zone: ${zone.name}`);
  //     this.platform.log.error(`${error}`);
  //     callback(error);
  //     return;
  //   }

  //   const state = this.convertVolumioCommandResponseToCharacteristicValue(data);
  //   callback(undefined, state);
  // }

  // /**
  //  * Get the Volume..
  //  */
  // getVolumeccccccibjdivbrvbbdiehdrchrbclegjkrjffntlnrib(callback: CharacteristicGetCallback) {
  //   const state = this.targetMediaState;
  //   this.platform.log.debug('Triggered GET CurrentMediaState:', state);
  //   callback(undefined, state);
  // }

  convertVolumioStateToCharacteristicValue(data?: VolumioAPIState): CharacteristicValue {
    let state = this.platform.Characteristic.CurrentMediaState.STOP;

    if (!data) {
      return state;
    }

    // These are the state strings returned by Volumio
    switch (data.status) {
      case 'play':
        state = this.platform.Characteristic.CurrentMediaState.PLAY;
        break;
      case 'pause':
        state = this.platform.Characteristic.CurrentMediaState.PAUSE;
        break;
      case 'stop':
      default:
        state = this.platform.Characteristic.CurrentMediaState.STOP;
        break;
    }

    return state;
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
