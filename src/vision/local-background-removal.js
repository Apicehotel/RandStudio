let runtimePromise=null;
export const LOCAL_BG_MODEL='Xenova/modnet';

export async function removeBackgroundLocal(file,{onStatus=()=>{}}={}){
  if(!file||!String(file.type||'').startsWith('image/'))throw new Error('Background removal locale richiede un file immagine');
  const {model,processor,RawImage}=await getRuntime(onStatus),url=URL.createObjectURL(file);
  try{
    onStatus('MODNet: preparazione immagine…');
    const img=await RawImage.fromURL(url),{pixel_values}=await processor(img);
    onStatus('MODNet: segmentazione locale…');
    const {output}=await model({input:pixel_values});
    const maskData=(await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(img.width,img.height)).data;
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img.toCanvas(),0,0);
    const pixels=ctx.getImageData(0,0,img.width,img.height);for(let i=0;i<maskData.length;i++)pixels.data[i*4+3]=maskData[i];ctx.putImageData(pixels,0,0);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG trasparente non creato')),'image/png'));
  }finally{URL.revokeObjectURL(url)}
}

async function getRuntime(onStatus){
  if(!runtimePromise)runtimePromise=(async()=>{
    onStatus('Caricamento MODNet locale…');
    const {env,AutoModel,AutoProcessor,RawImage}=await import('@huggingface/transformers');
    env.backends.onnx.wasm.proxy=false;
    const options=globalThis.navigator?.gpu?{device:'webgpu'}:{};
    const [model,processor]=await Promise.all([AutoModel.from_pretrained(LOCAL_BG_MODEL,options),AutoProcessor.from_pretrained(LOCAL_BG_MODEL)]);
    return{model,processor,RawImage};
  })();
  try{return await runtimePromise}catch(error){runtimePromise=null;throw error}
}
