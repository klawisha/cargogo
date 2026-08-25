import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function run(){
  const app=await NestFactory.createApplicationContext(AppModule,{logger:['error']});
  await app.close();
  console.log('PASS module graph: AppModule resolved successfully');
}
run().catch((error)=>{console.error('FAIL module graph',error);process.exitCode=1});
