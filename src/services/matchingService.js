/**
 * StudentForge Weighted Task Matching & Workload Balancer Engine
 */

const matchTasksToMembers = (tasks, members) => {
  console.log(`[MATCHING ENGINE] Starting allocation for ${tasks.length} tasks across ${members.length} members.`);

  // 1. Calculate total estimated hours to define the balancing threshold
  const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  
  // Cap workload fairly based on active team size
  const activeMembersCount = members.length;
  const averageLoad = totalEstimatedHours / activeMembersCount;
  
  // Set threshold at average load + 25% flexibility to allow minor deviations, keeping at least 12h for small projects
  const workloadThreshold = Math.max(averageLoad * 1.25, 12);
  
  console.log(`[MATCHING ENGINE] Total estimated workload: ${totalEstimatedHours} hours. Member load cap: ${workloadThreshold.toFixed(1)} hours.`);

  const assignments = {};
  const memberLoads = {};
  const matchLogs = [];

  // Initialize tracking containers
  members.forEach(member => {
    assignments[member.id] = [];
    memberLoads[member.id] = 0;
  });

  // Helper mapping: convert text levels to numeric weights
  const levelWeights = {
    advanced: 3,
    intermediate: 2,
    beginner: 1
  };

  // 2. Score and allocate tasks
  tasks.forEach(task => {
    let bestScore = -1;
    let bestMemberId = null;
    const taskLogs = [];

    members.forEach(member => {
      // Dimension A: Skill category and name match score (0 to 3) -> weighted by 0.4
      // We check if the skill category matches the task category, or if the skill name is referenced!
      const matchedSkill = member.skills?.find(s => 
        s.category.toLowerCase() === task.category.toLowerCase() ||
        s.skillName.toLowerCase() === task.category.toLowerCase() ||
        task.title.toLowerCase().includes(s.skillName.toLowerCase()) ||
        task.description.toLowerCase().includes(s.skillName.toLowerCase())
      );

      const skillLevelValue = matchedSkill ? (levelWeights[matchedSkill.level] || 1) : 0;
      const skillScore = (skillLevelValue / 3) * 0.4; // Normalized between 0 and 0.4

      // Dimension B: Availability score (0 to 1) -> weighted by 0.3
      const availabilityScore = Math.min((member.availabilityHours || 10) / 20, 1.0) * 0.3;

      // Dimension C: Reliability score (0 to 5) -> weighted by 0.2
      const reliabilityScore = ((member.reliabilityScore || 5.0) / 5.0) * 0.2;

      // Dimension D: Learning goals stretch bonus -> weighted by 0.1
      // Check if task involves keywords that match the member's bio or skills interest
      const matchesLearning = member.bio?.toLowerCase().includes(task.category.toLowerCase()) || 
                              task.description.toLowerCase().includes(task.category.toLowerCase());
      const learningScore = (matchesLearning ? 1.0 : 0.0) * 0.1;

      // Aggregate final weighted score
      const finalScore = skillScore + availabilityScore + reliabilityScore + learningScore;
      
      taskLogs.push({
        memberName: member.name,
        scores: {
          skill: skillScore.toFixed(3),
          availability: availabilityScore.toFixed(3),
          reliability: reliabilityScore.toFixed(3),
          learning: learningScore.toFixed(3),
          total: finalScore.toFixed(3)
        }
      });

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMemberId = member.id;
      }
    });

    // Assign to best member initially
    if (bestMemberId) {
      assignments[bestMemberId].push(task);
      memberLoads[bestMemberId] += (task.estimatedHours || 0);
      matchLogs.push({
        taskTitle: task.title,
        assignedTo: members.find(m => m.id === bestMemberId).name,
        score: bestScore.toFixed(3),
        logs: taskLogs
      });
    }
  });

  // 3. Workload Balancing Pass
  // If any member's load exceeds the threshold, reallocate their lowest-priority tasks
  let balancingRequired = true;
  let iterations = 0;
  
  while (balancingRequired && iterations < 15) {
    balancingRequired = false;
    iterations++;

    for (const memberId of Object.keys(memberLoads)) {
      const currentLoad = memberLoads[memberId];
      
      if (currentLoad > workloadThreshold && assignments[memberId].length > 1) {
        // Exceeds threshold! Find the member's lowest priority/hours task to offload
        const memberTasks = [...assignments[memberId]];
        memberTasks.sort((a, b) => {
          const priorityWeight = { low: 1, medium: 2, high: 3, critical: 4 };
          const aPriority = priorityWeight[a.priority] || 2;
          const bPriority = priorityWeight[b.priority] || 2;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return (a.estimatedHours || 0) - (b.estimatedHours || 0);
        });

        const taskToOffload = memberTasks[0]; // Take the lowest load candidate
        
        // Find next best member under workload limit
        let nextBestMemberId = null;
        let nextBestScore = -1;

        members.forEach(member => {
          if (member.id !== memberId && (memberLoads[member.id] + taskToOffload.estimatedHours) <= workloadThreshold) {
            const matchedSkill = member.skills?.find(s => 
              s.category.toLowerCase() === taskToOffload.category.toLowerCase()
            );
            const skillLevelValue = matchedSkill ? (levelWeights[matchedSkill.level] || 1) : 0;
            const score = skillLevelValue + ((member.reliabilityScore || 5.0) / 5.0);

            if (score > nextBestScore) {
              nextBestScore = score;
              nextBestMemberId = member.id;
            }
          }
        });

        if (nextBestMemberId) {
          console.log(`[BALANCER] Offloading "${taskToOffload.title}" (${taskToOffload.estimatedHours}h) from overloaded member to ${members.find(m => m.id === nextBestMemberId).name}`);
          
          // Re-route the task
          assignments[memberId] = assignments[memberId].filter(t => t.id !== taskToOffload.id);
          memberLoads[memberId] -= taskToOffload.estimatedHours;
          
          assignments[nextBestMemberId].push(taskToOffload);
          memberLoads[nextBestMemberId] += taskToOffload.estimatedHours;
          
          balancingRequired = true; // Run another check since loads have changed
          break; // Break active member loop to re-evaluate from top
        }
      }
    }
  }

  // 4. Learning Task Labeling Pass
  // For each member, identify at least one task that stretches their skill stack
  members.forEach(member => {
    const memberTasks = assignments[member.id];
    if (memberTasks.length > 0) {
      const learningTask = memberTasks.find(task => {
        const matchingSkill = member.skills?.find(s => s.skillName.toLowerCase() === task.category.toLowerCase());
        return !matchingSkill || matchingSkill.level === 'beginner';
      });

      if (learningTask) {
        learningTask.isLearningTask = true;
      } else {
        memberTasks[0].isLearningTask = true;
      }
    }
  });

  return {
    assignments,
    memberLoads,
    matchLogs
  };
};

module.exports = {
  matchTasksToMembers
};
