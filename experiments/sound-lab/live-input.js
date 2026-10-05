// PCM preview only. MediaRecorder remains the final recording source.
class LiveInput extends AudioWorkletProcessor {
  constructor(){super();this.chunk=new Float32Array(2048);this.offset=0;}
  process(inputs){
    const channel=inputs[0]?.[0];
    if(channel)for(const value of channel){this.chunk[this.offset++]=value;if(this.offset===this.chunk.length){this.port.postMessage(this.chunk,[this.chunk.buffer]);this.chunk=new Float32Array(2048);this.offset=0;}}
    return true;
  }
}
registerProcessor('sound-lab-live-input',LiveInput);
