## CNN

核心思想：

1. Local Connectivity（局部连接）

    普通神经网络是所有像素到神经元，导致参数巨大。

    CNN 是局部像素到一个神经元。

2. Parameter Sharing（参数共享）

    Shift Invariance Assumption: If a feature is useful at spatial position $(x, y)$, then it should also be useful for other positions $(x', y')$

卷积理解：

\[
(f*g)(t)=
\int f(\tau)g(t-\tau)d\tau
\]

不同 $t$，相当于向右移动函数 $g(-x)$ $t$ 个单位，每个位置计算重叠部分乘积，然后求和。

然后 CNN 就相当于一个二维卷积。尽管 CNN 是没有函数翻转，在数学中叫做 cross-correlation（互相关）。

注意卷积是可交换的，而 CNN 用到的 cross-correlation 是不可交换的。

![](https://img.lllei.top/i/2026/10/12/232521-0.webp)

从这张图也可以看出，convolution 是翻转后者后，将其向右移动。cross-correlation 是不翻转后者，将其向左移动。转换关系：

\[
\boxed{
[f(t)\star g(t)](t)
=
[\overline{f(-t)}*g(t)](t)
}
\]

CNN filter 在空间上很小（local receptive field），但在 channel 方向必须穿透整个深度。

所以：

\[
\boxed{
\text{5×5 filter on RGB image}
=
5\times5\times3
}
\]

增大感受野（receptive field）：

1. 增大 kernel
2. 堆多层卷积

但两者都会带来计算量增加。

Dilated Convolution（空洞卷积 / Atrous Convolution）：

![](https://img.lllei.top/i/2026/10/13/001126-0.webp)

通过指数选择，由唯一分解定理，理论上可以表示完整信息。

重要参数：

1. Kernel Size
2. Stride（步幅）：filter 每次移动多少格
3. Padding（填充）：输入边缘补多少圈
4. Dilation（膨胀率/空洞率）：filter 内部元素之间隔多远

![](https://img.lllei.top/i/2026/10/13/001332-0.webp)

引入激活函数：

![](https://img.lllei.top/i/2026/10/13/002154-0.webp)

CNN is a stack of Convolutional Layers, interspersed with activation functions. Note: Shrinking too fast in the spatial dimensions is not good, doesn’t work well.

超参数总结：

![](https://img.lllei.top/i/2026/10/13/002548-0.webp)

卷积负责“找特征”，Pooling 负责“压缩特征，同时降低对位置的敏感性”。

CNN经典结构：Conv -> ReLU -> Pooling

Max Pooling 取最大。Average Pooling 取平均。实际 max pooling 更常见，因为特征检测通常更关注有没有出现。

池化：

- Alleviate excessive sensitivity of convolutional layers to locations
- Reduce the resolution of images through the processing pipeline

Operates over each feature map independently: Pooling reduces dimensions of width and height. Depth keeps unchanged before and after pooling

空间金字塔池化（Spatial Pyramid Pooling, SPP）

由于 CNN 后面一般会接全连接层（用于最终处理获得想要的），所以传统 CNN 一般要求输入图片大小固定。而 SSP 就是通过池化，把它变成固定长度，从而不限制输入图片大小。

SSP 其实就是通过固定想要输出的规模大小，而自适应 Pooling 参数。

LeNet 和 AlexNet 对比：

![](https://img.lllei.top/i/2026/10/13/004751-0.webp)

Class Activation Mapping, CAM:

![](https://img.lllei.top/i/2026/10/13/005903-0.webp)

CNN 最后一层已经知道“哪些 feature 能判断类别”，CAM 利用这些 feature 对类别的权重，把 feature map 加权组合回来，得到一张热力图，显示图片中哪些区域最影响分类结果。因为用的是 GAP 之前的 feature map，所以可以插值还原到原图上。

## Batch Normalization

![](https://img.lllei.top/i/2026/10/13/103848-0.webp)

重点是引入了 $gamma$ 和 $beta$，防止表达能力受限。

BN 不会限制网络，因为它有能力恢复原来的数据（取特定 $gmma$ 和 $beta$ 时）。

放在 ReLu 前是为了防止输入分布偏移导致神经元坏死。

矩阵分解。

在相同 learning rate 下，BN 和非 BN 的测试准确率可以比较；而更大的 learning rate 对 BN 网络更加友好，非 BN 网络可能直接发散。BN 让网络对 learning rate 没那么脆弱，可以更大胆地进行梯度下降。

![](https://img.lllei.top/i/2026/10/16/145241-0.webp)

推理阶段的 $\mu$ 和 $\sigma$ 是由训练阶段通过 EMA（Exponential Moving Average，指数滑动平均）得到的，这也隐含了早期模型不稳定的时候占据的权重是指数级别，只占很少一部分。

由于 BN 在训练时带来的影响仍然是线性的，所以其实并没有增强模型的表达能力。只是有利于训练。

BN 有效性解释：

- ICS 解释：BN 让每一层看到的输入更稳定，因此更容易训练。被 **Noisy BN** 实验推翻。
- Smoothness 解释：BN 改善了优化时 loss 和梯度的变化性质，因此更容易训练。

A small batch leads to inaccurate estimation of the batch statistics. 因为 BN 希望根据大数定律，将每个样本视为独立。

GN: 不跨样本计算，而是在每张图片内部，把 Channel 分组进行归一化。

| 方法 | 统计范围                       | 是否跨 Batch |
| -- | -------------------------- | --------- |
| BN | 同一 Channel 的 N,H,W         | 是         |
| LN | 同一样本的 C,H,W                | 否         |
| IN | 同一样本、同一 Channel 的 H,W      | 否         |
| GN | 同一样本、同一组 Channel 的 C/G,H,W | 否         |

GN 是 LN 子集。是 IN 的超集。

![](https://img.lllei.top/i/2026/10/16/173101-0.webp)

BN

BN 训练时通过 mini-batch 估计每个 Channel 的统计量。

标准 BN 推理时使用固定的 running statistics，使得：

- 训练积累的统计尺度能够延续到推理阶段。
- 同一张图片不会因为和哪些其他图片组成 Batch 而改变预测。
- 即使 Feature Map 的空间尺寸很小，也不需要重新估计统计量。

GN

GN 从设计上就是针对单个样本内部的一组 Channel 进行归一化。
因此，无论训练还是推理，都是同一个公式、同一个统计范围。
它并不需要记录训练数据的总体均值和方差。

不变性 Invariance：比如一般的图像分类，把网球稍微移到右边，输出仍然是 Tennis ball。

$f(T(x))=f(x)$

等变性 Equivariance：比如目标定位，把网球移到右边，输出坐标也应该相应向右移动。

$f(T(x))=T(f(x))$

CNN is designed to be invariant to changes by adding pooling layer.

卷积天然具有平移等变性，Pooling 把一部分精确的位置差异丢掉了，因此模型不再那么在意网球具体位于窗口中的哪个位置。

在真实图像数据集上训练的 CNN，可能过度依赖纹理（texture），而不是充分利用物体的整体形状（shape）。解决方案：Augmentation by Stylization（通过风格化进行数据增广）。即保留原图的主要内容和形状，但改变它的纹理、颜色风格和局部外观。

CNN 可能过度依赖物体周围的环境和上下文。解决方案：把不同图片中的物体和场景进行各种组合，故意制造一些不寻常的图像。

Max Pooling 代价：模型保留了“这个区域存在强响应”的信息，却丢失了一部分精确的位置关系。所以就引入了 Capsule Network（胶囊网络）：它尝试在识别物体的同时，更好地保留姿态和空间关系。

胶囊网络：

![](https://img.lllei.top/i/2026/10/17/120544-0.webp)

没有看懂

## 预训练与后训练

1. Big Transfer（BiT）: Training on larger datasets is vital for better transferability.
2. Domain Adaptive Transfer（DAT）: Uses importance weighting to carefully choose the pre-training data that are most relevant to the target task.

Supervised pre-training gains high-level semantic knowledge.

Generative pre-training gains low-level representations.

Contrastive pre-training gains mid-level & low-level representations.

Instance Discrimination: 增光作为正样本，其他作为负样本

Non-parametric Softmax：普通的神经网络分类器通常会在最后一层学习一组分类权重，而 Non-parametric Softmax 是将 Memory Bank 中保存的各个实例特征，作为比较对象。

![](https://img.lllei.top/i/2026/10/18/112000-0.webp)

对比学习基本任务：

假设有一张图片 \(x\)，我们随机增广两次，得到两个视图：
\[
x^q=T_q(x),\qquad x^k=T_k(x)
\]

它们来自同一张原图，因此是正样本对。
我们把两个视图送进网络，得到：
\[
q=f_q(x^q),\qquad k^+=f_k(x^k)
\]

- \(q\)：Query（查询向量）。
- \(k^+\)：正样本 Key（键向量）。
我们希望 \(q\) 和 \(k^+\) 相似。

同时，还需要大量负样本 \(k_1^-,k_2^-,\ldots\)，让 \(q\) 能够区分不同的图片。

直接使用当前 mini-batch 会导致负样本很少，所以就有了 MoCo：把负样本特征存储在一个队列中，而不是每次都只从当前 mini-batch 获取。

简单流程：

![](https://img.lllei.top/i/2026/10/18/113556-0.webp)

![](https://img.lllei.top/i/2026/10/18/115637-0.webp)