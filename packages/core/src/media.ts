import { ChatbotError } from "./errors.js";

export function inspectImage(bytes:Buffer,declared:string,maxDimension:number){
  let mime="",width=0,height=0;
  if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){mime="image/png";width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);}
  else if(bytes.length>=30&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"){
    mime="image/webp";const kind=bytes.toString("ascii",12,16);
    if(kind==="VP8X"){width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);}
    else if(kind==="VP8L"&&bytes[20]===0x2f){width=1+(((bytes[22]!&0x3f)<<8)|bytes[21]!);height=1+(((bytes[24]!&0x0f)<<10)|(bytes[23]!<<2)|(bytes[22]!>>6));}
  } else if(bytes.length>4&&bytes[0]===0xff&&bytes[1]===0xd8){
    mime="image/jpeg";let i=2;while(i+9<bytes.length){if(bytes[i]!==0xff){i++;continue;}const marker=bytes[i+1]!,len=bytes.readUInt16BE(i+2);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){height=bytes.readUInt16BE(i+5);width=bytes.readUInt16BE(i+7);break;}if(len<2)break;i+=2+len;}
  }
  if(!mime||mime!==declared||!width||!height)throw new ChatbotError("invalid_image","Image format or dimensions are invalid.");
  if(width>maxDimension||height>maxDimension)throw new ChatbotError("image_too_large","Image dimensions exceed the configured limit.",413);
  return {mime,width,height};
}
