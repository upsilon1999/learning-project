<script setup>
//引入spark-MD5包
import sparkMD5 from "spark-md5"
import {ref} from "vue"

//储存文件名和hash值，上传文件需要
let fileName = ref("")
let fileHash = ref("")

//分块大小
const CHUNK_SIZE = 1024*1024 
//获取分块列表
const createFileChunks = (file) => {
  console.log(file);
  const fileChunkList = []
  let cur = 0
  while (cur < file.size) {
    const fileChunk = file.slice(cur, cur + CHUNK_SIZE)
    fileChunkList.push(fileChunk)
    cur += CHUNK_SIZE 
  }
  return fileChunkList
}

//获取hash
const calculateHash = async (fileChunks) => {
  return new Promise(resolve => {
    const spark = new sparkMD5.ArrayBuffer()
    const targets = []
    fileChunks.forEach((chunk, index) => {
      console.log(chunk);
      if (index === 0 || index === fileChunks.length - 1) {
        targets.push(chunk)
      } else {
        targets.push(chunk.slice(0, 2))
        targets.push(chunk.slice(CHUNK_SIZE / 2, CHUNK_SIZE / 2 + 2))
        targets.push(chunk.slice(CHUNK_SIZE - 2, CHUNK_SIZE))
      }
    })
    const reader = new FileReader()
    reader.readAsArrayBuffer(new Blob(targets))
    reader.onload = (e) => {
      spark.append(e.target.result)
      resolve(spark.end())
    }
  })
}



//分片上传
const uploadChunks =async (fileChunkList,existChunk) =>{
  console.log("待上传的文件",fileChunkList);
  /**
   * 1. 浏览器上传有最大并发请求数，所以我们要限制每次并发请求的数量
   * 2.每个切片都要构造一个FormData对象
   */

   //构造文件对象数组
   const data = fileChunkList.map((chunk,index)=>{
    return {
      //文件名字
      fileName:fileName.value,
      //文件hash
      fileHash:fileHash.value,
      // 块hash形式自定义，我们采用"块hash-index"
      chunkHash:fileHash.value+"-"+index,
      //存储每块数据
      chunkData:chunk
    }
   })
   console.log(data);

   //构造formdata对象
   //本质上和上一步可以写在一起，分开写是为了提高可读性

   //在上传之前通过过滤校验得到的已存在切片数组，来得到断点续传的效果
   const formDatas = data
   .filter((item)=>{
    return !existChunk.includes(item.chunkHash)
   })
   .map(item=>{
    const formData = new FormData()
    formData.append("fileName",item.fileName)
    formData.append("fileHash",item.fileHash)
    formData.append("chunkHash",item.chunkHash)
    formData.append("chunkData",item.chunkData)

    return formData
   })

   //查看构造出来的formData对象
   console.log(formDatas);

   //最大并发请求数
   const max = 6

   //标识当前上传到第几个了
   let idx = 0

   //建立请求池，请求池最多六个请求
   //每次完成一个再加入一个新的
   let taskPool = []

   //循环依次上传
   /**
    * ①每次上传都作为一次请求任务
    * ②请求完成后，如果请求再请求池中存在则删除
    * ③同步把任务加入请求池
    * ④如果请求池数量超过最大并发，就等至少一个执行完后再继续
    * ⑤如果没超过最大并发数，继续遍历增加任务
    */
   while (idx<formDatas.length) {

      //把每次上传请求作为一次请求任务
      const task = fetch("http://localhost:3000/upload",{
        method:"POST",
        body:formDatas[idx]
      })

      //每次发送完成就从请求池中移除
      //findIndex,返回数组中满足提供的测试函数的第一个元素的索引。若没有找到对应元素则返回 -1。
      //splice(start) 删除下标元素与之后的元素

      //请求完成后，判断请求任务是否在请求池中已存在，如果存在，删除该任务及他之后的任务
      task.then(()=>{
        taskPool.splice(taskPool.findIndex((item)=>item===task))
      })
     
      //这里是同步的，请求还没完成，将任务加入请求池
      taskPool.push(task)

      //当请求池长度达到最大并发时判断
      //如果请求池数量超过最大并发，就等至少一个执行完后再继续
      if(taskPool.length === max){
        // 请求池中是多个异步请求，所以采用promise的race方法等待至少一个完成
        await Promise.race(taskPool)
      }

      idx++
   }

   //请求池中是多个异步请求
   //等待所有请求都完成
   await Promise.all(taskPool)

   //所有切片上传请求都完成了
   //合并切片
   mergeRequest()
}

/**
 * 发请求给服务器，合并切片
 */
 const mergeRequest = ()=>{
  fetch("http://localhost:3000/upload/merge",{
    method:"POST",
    //指定请求头
    headers:{
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      size: CHUNK_SIZE,
      fileHash: fileHash.value,
      fileName: fileName.value,
    }),
  }).then(res=>{
    //成功的回调
    alert("合并成功")
  }).catch(()=>{
    alert("合并失败")
  })
}


/**
 * 校验，用于实现文件的秒传
 * 验证该文件是否需要上传，文件通过hash生成唯一，改名后也是不需要再上传的，也就相当于秒传
 */
const verify = async ()=>{
  return fetch("http://localhost:3000/upload/verify",{
    method:"POST",
    //指定请求头
    headers:{
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileHash: fileHash.value,
      fileName: fileName.value,
    }),
  })
  .then((response) => response.json())
  .then(res=>{
      console.log(res);
      // res中包含对应的表示服务器上有没有该文件的查询结果
      return res
    })
}


/**
 * 
 */
const handleUpload = async (e)=>{
  const files = e.target.files
  // 如果没有拿到，方法终止
  if(!files) return
  //反之，继续执行
  //执行分块函数
  const fileChunkList = createFileChunks(files[0])
  console.log(fileChunkList);
  fileName.value = files[0].name

  //计算文件hash值
  //不使用await将拿到一个promise对象
  const hashVal =await calculateHash(fileChunkList)
  console.log(hashVal);
  fileHash.value = hashVal

  //秒传的校验应该在上传之前
  const response =await verify()
  console.log(response);

  // 根据后端提示是否上传
  //true需要上传，false文件已存在,不用上传
  if(response.data.shouldUpload){
    //上传分片的操作
    uploadChunks(fileChunkList,response.data.existChunk)
  }else{
    alert("文件秒传成功")
  }
 
}

</script>

<template>
  <div>
    <h1>大文件上传</h1>
    <!-- 监听input框，通过绑定事件获取文件 -->
    <input type="file" @change="handleUpload">
  </div>
</template>

<style scoped>

</style>
