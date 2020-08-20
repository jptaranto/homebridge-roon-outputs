import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLUGIN_NAME } from './settings';
import { PluginPlatformAccessory } from './platformAccessory';
import { getVolumioAPIData, VolumioAPIZoneStates } from './utils';


/**
 * Add Volumio Zones as accessories.
 */
export class PluginPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // This is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  public zones;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.config = {
      ...config,
    };

    this.api.on('didFinishLaunching', () => {
      this.log.info('Finished initializing platform:', this.config.name);
      this.discoverZones();
    });
  }

  /**
   * Use the getZones rest API to retrieve all zones
   * @see https://volumio.github.io/docs/API/REST_API.html
   */
  async discoverZones() {
    try {
      this.log.info('Discovering Volumio zones...');

      const url = `${this.config.serverURL}/api/v1/getzones`;
      const { error, data } = await getVolumioAPIData<VolumioAPIZoneStates>(url);

      if (error || !data) {
        this.log.error(`Error discovering Volumio zones: ${error}`);
        this.log.error(`Data: ${data}`);
        return;
      }

      this.log.info(`${data.zones.length} Volumio zone${data.zones.length === 1 ? '' : 's'} discovered`);

      // strip states before saving to disk
      data.zones.forEach(zone => {
        delete zone.state;
      });

      this.zones = data.zones;

      this.addAccessories();
    } catch (err) {
      this.log.error(`Fatal discovering Volumio zones: ${err}`);
    }
  }

  /**
   * Use the returned value of get_outputs to create the speaker accessories.
   */
  addAccessories() {
    this.log.info(`Adding Volumio zone${this.zones.length === 1 ? '' : 's'}`);

    for (const zone of this.zones) {
      // Use Roons output_id to create the UUID. This will ensure the accessory is always in sync.
      const uuid = this.api.hap.uuid.generate(zone.id);

      this.log.info(`Adding/updating Volumio zone: ${zone.name}`);

      const accessory = new this.api.platformAccessory(zone.name, uuid);
      accessory.context.zone = zone;
      // Adding 26 as the category is some special sauce that gets this to work properly.
      // @see https://github.com/homebridge/homebridge/issues/2553#issuecomment-623675893
      accessory.category = 26;

      new PluginPlatformAccessory(this, accessory);

      // SmartSpeaker service must be added as an external accessory.
      // @see https://github.com/homebridge/homebridge/issues/2553#issuecomment-622961035
      // There a no collision issues when calling this multiple times on accessories that already exist.
      this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
    }
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * We don't actually restore any accessories, because each speaker is added as an External accessory
   * so this won't ever get called.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

}
