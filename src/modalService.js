// services/modalService.js
import { Modal } from 'antd';

class ModalService {
  constructor() {
    this.modalInstance = null;
  }

  info(options) {
    // 如果已有实例，先销毁
    if (this.modalInstance) {
      this.modalInstance.destroy();
    }

    // 创建新实例，并保存引用
    this.modalInstance = Modal.info({
      ...options,
      onClose: () => {
        // 在关闭时清除引用
        this.modalInstance = null;
        // 执行用户传入的 onClose
        if (options.onClose && typeof options.onClose === 'function') {
          options.onClose();
        }
      }
    });
    
    return this.modalInstance;
  }

  // 可以为其他类型的Modal（如success, error, confirm）也提供类似的方法
}

// 导出一个单例实例
const modalService = new ModalService();
export default modalService;