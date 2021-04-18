import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicGetCallback,
  CharacteristicEventTypes,
} from 'homebridge';

import { RoonOutputsPlatform } from './platform';

/**
 * Roon Outputs Platform Accessory.
 */
export class RoonOutputsPlatformAccessory {
  private service: Service;

  private currentMediaState: CharacteristicValue;

  private targetMediaState: CharacteristicValue;

  constructor(
    private readonly platform: RoonOutputsPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.currentMediaState = this.getRoonZoneState();
    this.targetMediaState = this.platform.Characteristic.CurrentMediaState.PAUSE;

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Roon')
      .setCharacteristic(this.platform.Characteristic.Model, 'Output')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.output.output_id,
      );

    this.service =
      this.accessory.getService(this.platform.Service.SmartSpeaker) ||
      this.accessory.addService(this.platform.Service.SmartSpeaker);

    // Allows name to show when adding speaker.
    // This has the added benefit of keeping the speaker name in sync with Roon and your config.
    this.service.setCharacteristic(
      this.platform.Characteristic.ConfiguredName,
      this.accessory.displayName,
    );

    // Event handlers for CurrentMediaState and TargetMediaState Characteristics.
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentMediaState)
      .on(CharacteristicEventTypes.GET, this.getCurrentMediaState.bind(this));
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetMediaState)
      .on(CharacteristicEventTypes.SET, this.setTargetMediaState.bind(this))
      .on(CharacteristicEventTypes.GET, this.getTargetMediaState.bind(this));

    // This will do its best to keep the actual outputs status up to date with Homekit.
    setInterval(() => {
      this.currentMediaState = this.getRoonZoneState();
      this.service
        .getCharacteristic(this.platform.Characteristic.CurrentMediaState)
        .updateValue(this.currentMediaState);
    }, 3000);
  }

  /**
   * Utility method to pull the actual status from the zone.
   */
  getRoonZoneState() {
    const zone = this.platform.core.services.RoonApiTransport.zone_by_zone_id(
      this.accessory.context.output.zone_id,
    );
    // If the output/zone doesn't exist for any reason (such as from being grouped, return stopped).
    if (!zone) {
      return this.platform.Characteristic.CurrentMediaState.STOP;
    }
    switch (zone.state) {
      case 'playing': {
        return this.platform.Characteristic.CurrentMediaState.PLAY;
      }
      case 'paused':
      case 'loading': {
        return this.platform.Characteristic.CurrentMediaState.PAUSE;
      }
      case 'stopped': {
        return this.platform.Characteristic.CurrentMediaState.STOP;
      }
      default: {
        return this.platform.Characteristic.CurrentMediaState.STOP;
      }
    }
  }

  /*
   * Utility to convert HomeKit State to Roon control API method
   * @see https://roonlabs.github.io/node-roon-api/other_node-roon-api-transport_lib.js.html
   */
  getRoonZoneMethod(state) {
    switch (state) {
      case this.platform.Characteristic.TargetMediaState.PLAY: {
        return 'play';
      }
      case this.platform.Characteristic.TargetMediaState.PAUSE: {
        return 'pause';
      }
      case this.platform.Characteristic.TargetMediaState.STOP: {
        return 'stop';
      }
    }
  }

  /**
   * Get the currentMediaState.
   */
  getCurrentMediaState(callback: CharacteristicGetCallback) {
    this.currentMediaState = this.getRoonZoneState();
    this.platform.log.debug('Triggered GET CurrentMediaState:', this.currentMediaState);
    callback(undefined, this.currentMediaState);
  }

  /**
   * Set the targetMediaState.
   * We aren't allowing Homekit to set the value for us,
   * instead we call the RoonApiTransport.control method.
   * Combined with the setInterval in the constructor the
   * output status should generally be good.
   */
  setTargetMediaState(value, callback: CharacteristicGetCallback) {
    this.targetMediaState = value;
    this.platform.log.debug('Triggered SET TargetMediaState:', value);
    if (this.targetMediaState !== this.currentMediaState) {
      // Only trigger state change if current and target states differ
      // This makes automations and scenes work properly
      const method = this.getRoonZoneMethod(this.targetMediaState);
      this.platform.log.debug('Invoking RoonApiTransport.control with:', method);
      // @see https://roonlabs.github.io/node-roon-api/other_node-roon-api-transport_lib.js.html
      this.platform.core.services.RoonApiTransport.control(
        this.accessory.context.output.zone_id,
        method,
        () => {
          callback(null);
        },
      );
    }
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
}
