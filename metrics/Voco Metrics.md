## Summarized key metrics:

* **Active Users (DAU, WAU, MAU):** Tracking daily, weekly, and monthly active users provides insights into overall user engagement and product stickiness.  
* **Core Feature Usage Rate:** Monitoring how often users utilize the primary voice-to-text feature and their usage volume (e.g., Credits consumed) reveals the perceived value and cost-effectiveness.  
* **Retention Rates (Day 1, Day 7, Day 30):** Evaluating how many new users return after 1, 7, and 30 days indicates the product's ongoing appeal and long-term value.  
* **"Sean Ellis Test" / PMF Core Question:** Assessing the percentage of users who would be "very disappointed" if they could no longer use the product is a direct measure of Product-Market Fit.  
* **Free-to-Paid Conversion Rate:** Observing the conversion rate from free to paid users helps gauge the effectiveness of the pricing strategy and the perceived value of paid plans.

找到PMF意味着您的产品在一个好的市场中，并且能够满足该市场的需求。这些指标将帮助您判断您的语音转文字应用是否达到了这个状态。

PMF的衡量通常是多维度的，结合了用户行为、用户反馈和商业表现。

## 测试阶段关注metrics

在用户测试阶段，您需要额外关注来验证“场景二”的数据点：

* 用户对200 Credits免费额度的反馈: 是否足够体验？用完后是否有付费意愿？  
* 对18元 (5000 Credits) 和 35元 (10000 Credits) 付费套餐的价值感知和价格接受度。  
* 实际的平均单句听写时长: 这依然重要，因为它影响您如何向用户沟通“Credits大约能用多久”，从而管理他们的期望值。  
* 用户是否理解Credit体系及其消耗方式。

如何收集这些数据：

* 产品分析工具 (Product Analytics): 追踪用户行为数据，如活跃度、功能使用、留存、Credit消耗等。  
* 问卷调查 (Surveys): 定期向测试用户发送问卷，收集NPS、CSAT、PMF核心问题以及对特定功能和价格的反馈。  
* 用户访谈 (User Interviews): 与部分测试用户进行深入交流，了解他们的使用场景、痛点、需求和对产品的真实感受。  
* A/B 测试 (A/B Testing): 如果条件允许，未来可以针对不同的Credit数量、价格或功能组合进行A/B测试，观察对转化率和用户行为的影响。

## 一、用户参与和活跃度 (User Engagement & Activity)

这些指标反映用户是否真的在活跃使用您的产品，以及他们使用的深度。

1. 活跃用户数 (Active Users):

   * DAU (日活跃用户): 每天使用产品的独立用户数。  
   * WAU (周活跃用户): 每周使用产品的独立用户数。  
   * MAU (月活跃用户): 每月使用产品的独立用户数。  
   * *为何重要:* 衡量产品的黏性基础和总体用户规模。对于语音产品，“活跃”可以定义为执行了至少一次语音转文字操作。  
2. 核心功能使用率 (Core Feature Usage Rate):

   * 关注点: 有多少活跃用户规律地使用核心的语音转文字功能？他们平均转写了多少内容（例如，每月消耗多少Credits，或者总计多少分钟的语音）？  
   * *为何重要:* 表明核心价值是否被用户认可和使用，也直接关联到您的API成本。  
3. 使用频率 (Session Frequency):

   * 关注点: 用户多久使用一次您的应用（例如，每天几次，每周几次）？  
   * *为何重要:* 高频率通常意味着产品解决了用户的日常痛点或已融入其工作流。  
4. 平均单次听写时长 / 平均每次API调用处理的音频时长:

   * 关注点: 用户平均单次听写（消耗1 Credit）的音频有多长？这是否符合您在成本模型中的预期（例如平均10秒、15秒或其他）？  
   * *为何重要:* 这个数据直接影响用户感知到的每个Credit的价值，以及您对“Credits能用多久”的市场沟通策略。  
5. 用户平均Credit消耗量:

   * 关注点: 在免费套餐和各付费套餐中，用户平均每月实际消耗多少Credits？这与套餐设定的上限相比如何？  
   * *为何重要:* 帮助您判断套餐的额度设计是否合理，用户是否觉得够用，或者是否有大量浪费/不足。

## 二、用户留存 (User Retention)

这些指标衡量用户是否会持续使用您的产品。

1. 次日留存率 (Day 1 Retention): 新用户在注册第二天后仍回访的比例。

2. 7日留存率 (Day 7 Retention): 新用户在一周后仍回访的比例。

3. 30日留存率 (Day 30 Retention): 新用户在一个月后仍回访的比例。

   * *为何重要:* 高留存率是PMF的强烈信号，说明产品具有持续的价值。  
4. 用户流失率 (Churn Rate): 在特定时期内停止使用产品的用户比例（尤其是付费用户的流失）。

   * *为何重要:* 低流失率意味着用户对产品满意并愿意长期使用。

## 三、用户满意度与口碑传播 (User Satisfaction & Advocacy)

这些指标反映用户对产品的喜好程度以及是否愿意推荐给他人。

1. **“Sean Ellis 测试” / PMF核心问题调研:**

   * **问题: “如果您明天开始无法再使用这款产品，您的感受会是？”**  
     * **A. 非常失望**  
     * **B. 有点失望**  
     * **C. 不会失望**  
     * **D. 无所谓，我已经不用了**  
   * ***为何重要:*** **通常认为，如果有\*\*超过40%\*\*的用户选择“非常失望”，则这是一个产品达到PMF的强有力信号。这是衡量PMF最直接的定性指标之一。**  
2. 净推荐值 (Net Promoter Score \- NPS):

   * 问题: “您有多大可能性将我们的产品推荐给朋友或同事？（0-10分）”  
   * *为何重要:* 衡量用户忠诚度和口碑传播意愿。  
3. 客户满意度 (Customer Satisfaction \- CSAT):

   * 问题: 针对特定功能（如转写准确度、速度）或整体使用体验提问，“您对XX的满意度如何？”  
   * *为何重要:* 直接了解用户对产品具体方面的满意程度。  
4. 定性反馈 (Qualitative Feedback):

   * 来源: 用户访谈、开放式问卷、应用商店评论、社交媒体评论、客服工单。  
   * *为何重要:* 提供关于用户为什么喜欢/不喜欢产品、他们遇到的问题、以及他们期望的功能等宝贵信息。

## 四、商业化与增长指标 (Monetization & Growth \- 针对您选择的场景二)

这些指标衡量产品的商业潜力及定价模型的有效性。

1. 免费用户向付费用户的转化率 (Free-to-Paid Conversion Rate):

   * 关注点: 有多少比例的免费用户（使用完200 Credits或体验后）升级到了付费套餐（标准版5000 Credits/18元 或 高级版10000 Credits/35元）？  
   * *为何重要:* 这是验证您“平衡发展型”定价策略是否成功的核心指标。  
2. 付费套餐选择分布 (Paid Tier Distribution):

   * 关注点: 付费用户更倾向于选择哪个套餐（标准版 vs 高级版）？这是否符合您的预期？  
   * *为何重要:* 帮助您了解哪个套餐的价值主张更吸引人。  
3. 平均每付费用户收入 (ARPPU \- Average Revenue Per Paying User):

   * 关注点: 每个付费用户平均贡献多少收入。  
   * *为何重要:* 衡量付费用户的价值。  
4. 用户获取成本 (CAC \- Customer Acquisition Cost) vs 用户生命周期价值 (LTV \- Lifetime Value):

   * 关注点: (如果开始进行市场推广) 获取一个新用户（尤其是付费用户）的成本，以及这个用户在整个使用周期内能带来的总价值。理想情况下LTV \>\> CAC。  
   * *为何重要:* 判断商业模式的长期健康度。

通过系统地收集和分析这些数据，您将能够更准确地判断您的产品是否接近或达到了PMF，并找到持续优化产品和定价策略的方向。

