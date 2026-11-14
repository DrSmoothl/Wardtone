import {it,expect} from 'vitest';
import net from 'node:net';
import {AdbServerClient} from '@yume-chan/adb';
import {TcpAdbConnector} from '../src/core/adb-server';

async function server(handler:(socket:net.Socket)=>void){
 const sockets=new Set<net.Socket>();
 const instance=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));handler(socket)});
 await new Promise<void>(resolve=>instance.listen(0,'127.0.0.1',resolve));
 const address=instance.address();if(!address||typeof address==='string')throw new Error('TCP test address unavailable');
 return{port:address.port,async close(){for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>instance.close(()=>resolve()))}};
}
it('reads fragmented ADB device responses over a real TCP connection',async()=>{
 const requests:string[]=[];
 const mock=await server(socket=>socket.on('data',data=>{
   requests.push(data.toString());
   const body='emulator-5554          device product:test model:Test_Emulator device:generic transport_id:1\n';
   const response=Buffer.from('OKAY'+Buffer.byteLength(body).toString(16).padStart(4,'0')+body);
   socket.write(response.subarray(0,5));setImmediate(()=>socket.end(response.subarray(5)));
 }));
 try{
   const client=new AdbServerClient(new TcpAdbConnector(mock.port,500));
   const devices=await client.getDevices(['device']);expect(devices[0].serial).toBe('emulator-5554');expect(devices[0].model).toBe('Test_Emulator');
   expect(requests.join('')).toContain('host:devices-l');
 }finally{await mock.close()}
});
it('fails visibly when a service accepts connections but never answers ADB',async()=>{
 const mock=await server(()=>{});
 try{await expect(new AdbServerClient(new TcpAdbConnector(mock.port,80)).getDevices()).rejects.toThrow('超时')}
 finally{await mock.close()}
});
it('reports ADB server failures rather than an empty device list',async()=>{
 const mock=await server(socket=>socket.once('data',()=>socket.end('FAIL0011permission denied')));
 try{await expect(new AdbServerClient(new TcpAdbConnector(mock.port,500)).getDevices()).rejects.toThrow()}
 finally{await mock.close()}
});
