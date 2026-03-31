import { _decorator, assetManager, director, Component } from 'cc';
const { ccclass } = _decorator;

@ccclass('Start')
export class Start extends Component {
    start() {
        // 加载名为 "game" 的分包，加载完成后跳转到真正的游戏场景
        assetManager.loadBundle("game", (err, bundle) => {
            if (err) {
                console.error("加载分包失败: ", err);
                return;
            }
            // 假设你的游戏主场景叫 "Main"
            director.loadScene("Main");
        });
    }
}
