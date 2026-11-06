/* Local PCM capture only. The graph is created solely after a Record click. */
class NardouchPCM extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice());
    return true;
  }
}
registerProcessor("nardouch-pcm", NardouchPCM);
