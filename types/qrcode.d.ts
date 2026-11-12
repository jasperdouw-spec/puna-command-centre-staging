declare module 'qrcode' {
 const QRCode:{toDataURL(text:string,options?:{width?:number;margin?:number;errorCorrectionLevel?:'L'|'M'|'Q'|'H'}):Promise<string>;toCanvas(canvas:HTMLCanvasElement,text:string,options?:{width?:number;margin?:number;errorCorrectionLevel?:'L'|'M'|'Q'|'H'}):Promise<void>};
 export default QRCode;
}
