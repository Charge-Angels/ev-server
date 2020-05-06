import { Factory } from 'rosie';
import faker from 'faker';

export default Factory.define('chargingStation')
  .attr('chargePointVendor', () => 'Schneider Electric')
  .attr('chargePointModel', () => 'MONOBLOCK')
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => 'EV.2S22P44' + faker.random.alphaNumeric(15).toUpperCase())
  .attr('firmwareVersion', () => faker.random.alphaNumeric(25));
