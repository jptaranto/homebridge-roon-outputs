import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLUGIN_NAME } from './settings';
import { PluginPlatformAccessory } from './platformAccessory';

// import RoonApi from 'node-roon-api';
// import RoonApiStatus from 'node-roon-api-status';
// import RoonApiTransport from 'node-roon-api-transport';
import curl from 'curl';

/**
 * Add Roon outputs as accessories.
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
      this.log.debug('Finished initializing platform:', this.config.name);
      this.discoverZones();
    });
  }

  /**
   * Use the getZones rest API to retrieve all zones
   * @see https://volumio.github.io/docs/API/REST_API.html
   */
  discoverZones() {
    this.log.debug('Discovering Volumio Zones...');

    const url = `${this.config.serverURL}/api/v1/getzones`;
    let err = null;
    let response = null;
    let data: null | any = null;
    curl.getJSON(url, {}, (curlErr, curlResponse, curlData) => {
      err = curlErr;
      response = curlResponse;
      data = curlData;
    });
    
    if (response !== 200) {
      this.log.error(`Error Discovering Volumio Zones: http ${response} - ${err}`);
    }

    this.zones = data?.zones;
    this.log.debug(`${this.zones.length} Volumio Zone${this.zones.length === 1 ? '' : 's'} Discovered`);

    if (err === null) {
      this.addAccessories();
    }


    // const roon = new RoonApi({
    //   extension_id: PLUGIN_NAME,
    //   display_name: PLATFORM_NAME,
    //   display_version: '0.1.2',
    //   publisher: 'Homebridge',
    //   email: 'anonymous@gmail.com',
    //   log_level: 'none',
    //   core_paired: (core) => {
    //     this.log.debug(`Paired with ${core.display_name}.`);
    //     this.core = core;
    //     // Calling this and saving the value allows us to use RoonApiTransport.control later on.
    //     this.core.services.RoonApiTransport.subscribe_zones((error, response) => {
    //       if (error) {
    //         return;
    //       }
    //       this.zones = response.zones;
    //     });
    //     // We want the phyisical speakers to be based on outputs, not zones, so
    //     this.core.services.RoonApiTransport.get_outputs((error, response) => {
    //       if (error) {
    //         return;
    //       }
    //       this.outputs = response.outputs;
    //       this.addAccessories();
    //     });
    //   },
    //   core_unpaired: (core) => {
    //     this.log.debug(`Unpaired with ${core.display_name}.`);
    //   },
    // });

    // this.svcStatus = new RoonApiStatus(roon);

    // roon.init_services({
    //   required_services: [ RoonApiTransport ],
    //   provided_services: [ this.svcStatus ],
    // });
    // roon.start_discovery();
  }

  /**
   * Use the returned value of get_outputs to create the speaker accessories.
   */
  addAccessories() {
    this.log.info(`Adding ${this.zones.length} Volumio Zones`);

    for (const zone of this.zones) {
      // Use Roons output_id to create the UUID. This will ensure the accessory is always in sync.
      const uuid = this.api.hap.uuid.generate(zone.id);

      this.log.info(`Adding/Updating Volumio Zone: ${zone.name}`);

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
