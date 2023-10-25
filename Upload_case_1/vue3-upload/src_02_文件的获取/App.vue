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

<style scoped>

</style>
