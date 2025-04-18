# 网页版飞机大战游戏

这是一个使用HTML5 Canvas和原生JavaScript开发的简单飞机大战游戏，支持GitHub Pages部署和PWA功能。

## 游戏特点

- 简单的2D画面
- 键盘和触摸屏控制
- 射击敌机获取分数
- 本地存储最高分
- PWA支持，可离线运行
- 移动端适配

## 如何部署到GitHub Pages

1. Fork或克隆此仓库
2. 进入仓库设置 (Settings)
3. 滚动到GitHub Pages部分
4. 在Source下拉菜单中选择main分支
5. 点击Save，等待GitHub处理
6. 访问生成的URL（通常是 `https://你的用户名.github.io/仓库名/`）

## 离线使用

本游戏支持PWA功能，可以添加到主屏幕离线使用：

1. 在Chrome或Safari浏览器中打开游戏
2. 使用浏览器菜单的"添加到主屏幕"选项
3. 完成添加后，游戏将可以离线启动和使用

## 游戏控制

- 电脑版：方向键或WASD控制飞机移动，空格键发射子弹
- 移动设备：触摸屏幕滑动控制飞机移动，移动时会自动发射子弹
- P键：暂停游戏

## 游戏规则

1. 控制飞机躲避敌机
2. 发射子弹击落敌机获得分数
3. 每击落一架敌机得10分
4. 如果被敌机撞到，游戏结束
5. 游戏会记录并显示您的最高分

## 技术细节

- 使用HTML5 Canvas进行2D渲染
- 原生JavaScript实现游戏逻辑
- Web Audio API处理游戏音效
- Service Worker提供离线缓存
- localStorage保存最高分记录

## 自定义素材

您可以自行替换assets目录中的图片和音效，只需保持文件名和格式一致。 