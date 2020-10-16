import { getStatus, history, publish, pull } from './publish';

function initialize(registration) {
  const plugin = {
    customDescription: 'Publish bot to Power Virtual Agents (Preview)',
    bundleId: 'publish',
    history,
    getStatus,
    publish,
    pull,
  };
  registration.addPublishMethod(plugin);
}

module.exports = {
  initialize,
};
