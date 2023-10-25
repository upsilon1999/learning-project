# 前端Vue3

## 项目创建

```sh
npm init vue@latest
#自定义项目名
```

## 初始项目

`App.vue`

```vue
<script setup>

</script>

<template>
  <div>
    <h1>大文件上传</h1>
    <input type="file" name="" id="">
  </div>
</template>

<style scoped>

</style>
```

## 文件的获取

`App.vue`

```vue
<script setup>
/**
 * 通过事件对象参数获取文件
 */
const handleUpload = (e)=>{
  /**
   * e.target.files是个Filelist
   * 是个伪数组，可以通过索引下标去获取具体的每一项
   * 但是没有数组的方法
   */
  console.log(e.target.files);

  const files = e.target.files
 
  // 如果没有拿到，方法终止
  if(!files) return

  //反之，继续执行
  /**
   * 拿到file文件对象
   */
  console.log(files[0]);
}
</script>

<template>
  <div>
    <h1>大文件上传</h1>
    <!-- 监听input框，通过绑定事件获取文件 -->
    <input type="file" @change="handleUpload">
  </div>
</template>
```

## 文件的分块

`App.vue`

```vue
<script setup>
// 文件分片的函数

/**
 * 文件分片的核心是用Blob对象的slice方法，
 * 上一步获取到选择的文件是一个File对象，它是继承于Blob
 * 所以我们就可以用slice方法对文件进行分片，语法如下
 * let blob = instanceOfBlob.slice([start [, end [, contentType]]]};
 * 
 * start和end代表Blob里的下标，表示被拷贝进新的 Blob 的字节的起始位置和结束位置。
 * contentType 会给新的 Blob 赋予一个新的文档类型
 * 
 * 1GB = 1024MB = 1024*1024KB = 1024*1024*1024B
 */
//分块大小
const CHUNK_SIZE = 1024*1024 //1MB
/**
 * @param file是文件对象
 */
 const createFileChunks = (file) => {
  // 文件分块数组
  const fileChunkList = []
  //下标，知道文件分块位置
  let cur = 0
  /**
   * 如果分块位置小于文件大小，代表还能分块
   * CHUNK_SIZE 每块的大小，常量控制分块大小
   */
  while (cur < file.size) {
    const fileChunk = file.slice(cur, cur + CHUNK_SIZE)
    fileChunkList.push(fileChunk)
    cur += CHUNK_SIZE // CHUNK_SIZE为分片的大小
  }
  return fileChunkList
}

const handleUpload = (e)=>{
  const files = e.target.files
 
  // 如果没有拿到，方法终止
  if(!files) return

  //反之，继续执行
  console.log(files[0]);

  //执行分块函数
  const fileChunkList = createFileChunks(files[0])
  console.log(fileChunkList);
}
</script>
```

## 文件的校验

>校验的原因

```sh
1.避免重复上传，节省空间
2.后端如果采用同样的校验算法，可以知道文件是否损坏
3.下载后可以通过提供的校验算法，知道文件是否损坏
```

>常用校验方式

```sh
1. hash校验
2. md5校验
```

### hash

先来思考一个问题，在向服务器上传文件时，怎么去区分不同的文件呢？如果根据文件名去区分的话可以吗？

答案是不可以，因为文件名我们可以是随便修改的，所以不能根据文件名去区分。但是每一份文件的文件内容都不一样，我们可以根据文件的内容去区分，具体怎么做呢？

可以根据文件内容生产一个唯一的 `hash` 值，大家应该都见过用 `webpack` 打包出来的文件的文件名都有一串不一样的字符串，这个字符串就是根据文件的内容生成的 `hash` 值，文件内容变化，`hash` 值就会跟着发生变化。我们在这里，也可以用这个办法来区分不同的文件。而且通过这个办法，我们还可以实现秒传的功能，怎么做呢？

就是服务器在处理上传文件的请求的时候，要先判断下对应文件的 `hash` 值有没有记录，如果A和B先后上传一份内容相同的文件，所以这两份文件的 `hash` 值是一样的。当A上传的时候会根据文件内容生成一个对应的 `hash` 值，然后在服务器上就会有一个对应的文件，B再上传的时候，服务器就会发现这个文件的 `hash` 值之前已经有记录了，说明之前已经上传过相同内容的文件了，所以就不用处理B的这个上传请求了，给用户的感觉就像是实现了秒传。

那么怎么计算文件的hash值呢？可以通过一个工具：`spark-md5`，所以我们得先安装它。

在上一步获取到了文件的所有切片，我们就可以用这些切片来算该文件的 `hash` 值，但是如果一个文件特别大，每个切片的所有内容都参与计算的话会很耗时间，所有我们可以采取以下策略：

1. 第一个和最后一个切片的内容全部参与计算

2. 中间剩余的切片我们分别在前面、后面和中间取2个字节参与计算

这样就既能保证所有的切片参与了计算，也能保证不耗费很长的时间

>安装md5工具

```sh
npm i spark-md5
```

>抽样hash

```vue
<script setup>
//引入spark-MD5包
import sparkMD5 from "spark-md5"

//分块大小
const CHUNK_SIZE = 1024*1024 
/**
 * 计算文件的hash值，计算的时候并不是根据所用的切片的内容去计算的，那样会很耗时间，我们采取下面的策略去计算：
 * 1. 第一个和最后一个切片的内容全部参与计算
 * 2. 中间剩余的切片我们分别在前面、后面和中间取2个字节参与计算
 * 这样做会节省计算hash的时间
 */
/**
 * @param fileChunks 切片数组
 */
/*
  之所以使用promise是因为spark-md5的计算是异步的，
  而我们上传文件是同步的
*/
 const calculateHash = async (fileChunks) => {
  //spark-md5的使用推荐官方文档
  return new Promise(resolve => {

    const spark = new sparkMD5.ArrayBuffer()

    //1.第一个和最后一个切片全部参与计算
    //2.中间的切片只计算前两个字节、中间两个字节、最后两个字节
    //存储所有参与计算的切片
    const targets = []

    fileChunks.forEach((chunk, index) => {
      if (index === 0 || index === fileChunks.length - 1) {
        // 1. 第一个和最后一个切片的内容全部参与计算
        targets.push(chunk)
      } else {
        // 2. 中间剩余的切片我们分别在前面、后面和中间取2个字节参与计算
        // 前面的2字节
        targets.push(chunk.slice(0, 2))
        // 中间的2字节
        targets.push(chunk.slice(CHUNK_SIZE / 2, CHUNK_SIZE / 2 + 2))
        // 后面的2字节
        targets.push(chunk.slice(CHUNK_SIZE - 2, CHUNK_SIZE))
      }
    })

    //声明一个读取对象
    const reader = new FileReader()
    reader.readAsArrayBuffer(new Blob(targets))
    reader.onload = (e) => {
      spark.append(e.target.result)
      resolve(spark.end())
    }
  })
}


const createFileChunks = (file) => {
  const fileChunkList = []
  let cur = 0
  while (cur < file.size) {
    const fileChunk = file.slice(cur, cur + CHUNK_SIZE)
    fileChunkList.push(fileChunk)
    cur += CHUNK_SIZE 
  }
  return fileChunkList
}

const handleUpload = async (e)=>{
  const files = e.target.files
  // 如果没有拿到，方法终止
  if(!files) return
  //反之，继续执行
  //执行分块函数
  const fileChunkList = createFileChunks(files[0])

  //计算文件hash值
  //不使用await将拿到一个promise对象
  const hashVal =await calculateHash(fileChunkList)
  console.log(hashVal);
}

</script>
```

## 文件的上传

前面已经完成了上传的前置操作，接下来就来看下如何去上传这些切片。

我们以1G的文件来分析，假如每个分片的大小为1M，那么总的分片数将会是1024个，如果我们同时发送这1024个分片，浏览器肯定处理不了，原因是切片文件过多，浏览器一次性创建了太多的请求。这是没有必要的，拿 chrome 浏览器来说，默认的并发数量只有 6，过多的请求并不会提升上传速度，反而是给浏览器带来了巨大的负担。因此，我们有必要限制前端请求个数。

怎么做呢，我们要创建最大并发数的请求，比如6个，那么同一时刻我们就允许浏览器只发送6个请求，其中一个请求有了返回的结果后我们再发起一个新的请求，依此类推，直至所有的请求发送完毕。

上传文件时一般还要用到 `FormData` 对象，需要将我们要传递的文件还有额外信息放到这个 `FormData` 对象里面。

```js
//分片上传
const uploadChunks =async (fileChunkList) =>{
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
   const formDatas = data.map(item=>{
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
}
```

>开启上传

```vue
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
const uploadChunks =async (fileChunkList) =>{
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
   const formDatas = data.map(item=>{
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
}




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


  //上传分片的操作
  uploadChunks(fileChunkList)
}

</script>
```

## 文件的合并

文件上传完成之后，就可以将文件合并成一个完整的文件了。

前端只需要向服务器发送一个合并的请求，并且为了区分要合并的文件，需要将文件的hash传递给后端。

```js
/**
 * 发请求给服务器，合并切片
 */
 const mergeRequest = ()=>{
  fetch("http://localhost:3000/upload",{
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
```

>完整调用

```vue
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
const uploadChunks =async (fileChunkList) =>{
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
   const formDatas = data.map(item=>{
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
  fetch("http://localhost:3000/upload",{
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


  //上传分片的操作
  uploadChunks(fileChunkList)
}

</script>
```

到这里，我们就已经实现了大文件的分片上传的基本功能了，但是我们没有考虑到如果上传相同的文件的情况，而且如果中间网络断了，我们就得重新上传所有的分片，这些情况在大文件上传中也都需要考虑到，下面，我们就来解决下这两个问题。

## 文件的秒传

我们在上面有提到，如果内容相同的文件进行hash计算时，对应的hash值应该是一样的，而且我们在服务器上给上传的文件命名的时候就是用对应的hash值命名的，所以在上传之前是不是可以加一个判断，如果有对应的这个文件，就不用再重复上传了，直接告诉用户上传成功，给用户的感觉就像是实现了秒传。接下来，就来看下如何实现的。

前端在上传之前，需要将对应文件的hash值告诉服务器，看看服务器上有没有对应的这个文件，如果有，就直接返回，不执行上传分片的操作了。

```js
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
```

关键点

```sh
async之后，配合了return，使用的时候要加 await

如果只用async，不用return，使用的时候不需要加await，但会存在隐患

也可以把里面的then全部改成await，结合async，那样也不需要return，也没有隐患
```

>使用

```vue
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
const uploadChunks =async (fileChunkList) =>{
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
   const formDatas = data.map(item=>{
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
    uploadChunks(fileChunkList)
  }else{
    alert("文件秒传成功")
  }
 
}

</script>
```

完成上面的步骤后，当我们再上传相同的文件，即使改了文件名，也会提示我们秒传成功了，因为服务器上已经有对应的那个文件了。

上面我们解决了重复上传的文件，但是对于网络中断需要重新上传的问题没有解决，那该如何解决呢？

如果我们之前已经上传了一部分分片了，我们只需要再上传之前拿到这部分分片，然后再过滤掉是不是就可以避免去重复上传这些分片了，也就是只需要上传那些上传失败的分片，所以，再上传之前还得加一个判断。

## 断点续传

我们还是在那个 `verify` 的接口中去获取已经上传成功的分片，然后在上传分片前进行一个过滤

校验后传入已经上传的切片数据

```js
 // 根据后端提示是否上传
  //true需要上传，false文件已存在,不用上传
  if(response.data.shouldUpload){
    //上传分片的操作
    uploadChunks(fileChunkList,response.data.existChunk)
  }else{
    alert("文件秒传成功")
  }
```

在上传构造formData时做一个过滤

```js
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
```



