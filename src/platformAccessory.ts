import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicGetCallback,
  CharacteristicEventTypes,
} from 'homebridge';

import { PluginPlatform } from './platform';
import curl from 'curl';

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
    // This has the added benefit of keeping the speaker name in sync with Roon and your config.
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);

    // Event handlers for CurrentMediaState and TargetMediaState Characteristics.
    this.service.getCharacteristic(this.platform.Characteristic.CurrentMediaState)
      .on(CharacteristicEventTypes.GET, this.getCurrentMediaState.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.TargetMediaState)
      .on(CharacteristicEventTypes.SET, this.setTargetMediaState.bind(this))
      .on(CharacteristicEventTypes.GET, this.getTargetMediaState.bind(this));

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
    let err = null;
    let response = null;
    let data: null | any = null;
    curl.getJSON(url, {}, (curlErr, curlResponse, curlData) => {
      err = curlErr;
      response = curlResponse;
      data = curlData;
    });

    if (response !== 200 || err !== null) {
      this.platform.log.error(`Error getting state for Zone: ${zone.name}`);
      this.platform.log.error(`http ${response} - ${err}`);
    }

    return this.convertVolumioState(data.status);
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
    let err = null;
    let response = null;
    let data: null | any = null;
    curl.getJSON(url, {}, (curlErr, curlResponse, curlData) => {
      err = curlErr;
      response = curlResponse;
      data = curlData;
    });

    if (response !== 200 || err !== null) {
      this.platform.log.error(`Error setting target media state for Zone: ${zone.name}`);
      this.platform.log.error(`http ${response} - ${err}`);
    }

    const state = this.convertVolumioState(data.status);
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

  convertVolumioState(data: any) {
    let state = this.platform.Characteristic.CurrentMediaState.STOP;

    // These are the state strings returned by Volumio
    switch (data.status) {
      case 'play':
        state = this.platform.Characteristic.CurrentMediaState.PLAY;
        break;
      case 'pause':
        state = this.platform.Characteristic.CurrentMediaState.PAUSE;
        break;
      case 'stop':
        state = this.platform.Characteristic.CurrentMediaState.STOP;
        break;
    }

    return state;
  }
}
