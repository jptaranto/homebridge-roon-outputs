import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { RoonOutputsPlatformAccessory } from './platformAccessory';

import RoonApi from 'node-roon-api';
import RoonApiStatus from 'node-roon-api-status';
import RoonApiTransport from 'node-roon-api-transport';

/**
 * Add Roon outputs as accessories.
 */
export class RoonOutputsPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // This is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  public core;

  public zones;

  public outputs;

  public svcStatus;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.config = {
      postfix: 'Speaker',
      ...config,
    };

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Finished initializing platform:', this.config.name);
      this.discoverRoon();
    });
  }

  /**
   * Use the RoonApi to pair with the local core.
   * @see https://roonlabs.github.io/node-roon-api/RoonApi.html
   */
  discoverRoon() {
    this.log.debug('Initializing Roon Node API...');
    const roon = new RoonApi({
      extension_id: PLUGIN_NAME,
      display_name: PLATFORM_NAME,
      display_version: '0.1.2',
      publisher: 'Homebridge',
      email: 'anonymous@gmail.com',
      log_level: 'none',
      core_paired: (core) => {
        this.log.debug(`Paired with ${core.display_name}.`);
        this.core = core;
        // Calling this and saving the value allows us to use RoonApiTransport.control later on.
        this.core.services.RoonApiTransport.subscribe_zones((error, response) => {
          if (error) {
            return;
          }
          this.zones = response.zones;
        });
        // We want the phyisical speakers to be based on outputs, not zones, so
        this.core.services.RoonApiTransport.get_outputs((error, response) => {
          if (error) {
            return;
          }
          this.outputs = response.outputs;
          this.addAccessories();
        });
      },
      core_unpaired: (core) => {
        this.log.debug(`Unpaired with ${core.display_name}.`);
      },
    });

    this.svcStatus = new RoonApiStatus(roon);

    roon.init_services({
      required_services: [ RoonApiTransport ],
      provided_services: [ this.svcStatus ],
    });
    roon.start_discovery();
  }

  /**
   * Use the returned value of get_outputs to create the speaker accessories.
   */
  addAccessories() {
    // This only flashes momentarily, but hey, it probably shows up in logs.
    this.svcStatus.set_status('Adding/Updating output accessories...', false);

    for (const output of this.outputs) {
      // Use Roons output_id to create the UUID. This will ensure the accessory is always in sync.
      const uuid = this.api.hap.uuid.generate(output.output_id);

      // Create the accessory name based on the display_name and the optional config.postfix value.
      const name = `${output.display_name}${this.config.postfix ? ' ' + this.config.postfix : ''}`;

      this.log.info(`Adding/Updating Roon Output External Accessory: ${name}`);

      const accessory = new this.api.platformAccessory(name, uuid);
      accessory.context.output = output;
      // Adding 26 as the category is some special sauce that gets this to work properly.
      // @see https://github.com/homebridge/homebridge/issues/2553#issuecomment-623675893
      accessory.category = 26;

      new RoonOutputsPlatformAccessory(this, accessory);

      // SmartSpeaker service must be added as an external accessory.
      // @see https://github.com/homebridge/homebridge/issues/2553#issuecomment-622961035
      // There a no collision issues when calling this multiple times on accessories that already exist.
      this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
    }

    // Tell Roon we are ready to rock!
    this.svcStatus.set_status('Successful', false);
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
