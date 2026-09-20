let token = localStorage.getItem("sd_token");
let me = null;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

async function api(url, options={}) {
  options.headers = options.headers || {};
  if (token) options.headers.Authorization = `Bearer ${token}`;
  const r = await fetch(url, options);
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function showLogin(){ $("loginForm").classList.remove("hidden"); $("registerForm").classList.add("hidden"); }
function showRegister(){ $("loginForm").classList.add("hidden"); $("registerForm").classList.remove("hidden"); }

async function login(e){
  e.preventDefault();
  try{
    const d=await api("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("loginEmail").value,password:$("loginPassword").value})});
    token=d.token; localStorage.setItem("sd_token",token); await boot();
  }catch(err){$("authMsg").textContent=err.message}
}
async function register(e){
  e.preventDefault();
  try{
    await api("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      name:$("regName").value,email:$("regEmail").value,password:$("regPassword").value,branch:$("regBranch").value,semester:$("regSem").value
    })});
    $("authMsg").textContent="Account created. Please login.";
    showLogin();
  }catch(err){$("authMsg").textContent=err.message}
}
function logout(){localStorage.removeItem("sd_token");token=null;location.reload()}

async function boot(){
  if(!token){$("authView").classList.remove("hidden");$("appView").classList.add("hidden");return}
  try{
    me=await api("/api/me");
    $("authView").classList.add("hidden");$("appView").classList.remove("hidden");
    $("userBox").innerHTML=`${esc(me.name)} <span class="pill">${esc(me.role)}</span>`;
    if(me.role==="admin"||me.role==="senior") $("adminNav").classList.remove("hidden");
    openPage("dashboard");
  }catch{logout()}
}

async function openPage(page){
  if(page==="dashboard") return dashboard();
  if(page==="challenges") return challenges();
  if(page==="submissions") return submissions();
  if(page==="resources") return resources();
  if(page==="admin") return admin();
}

async function dashboard(){
  const [cs,subs,anns]=await Promise.all([api("/api/challenges"),api("/api/my-submissions"),api("/api/announcements")]);
  const done=subs.length, total=cs.length, reviewed=subs.filter(x=>x.status==="reviewed").length;
  $("page").innerHTML=`
  <div class="card"><span class="badge">Student Dashboard</span><h2>Welcome, ${esc(me.name)} 👋</h2>
  <p class="muted">Learn → Practice → Submit → Get Feedback → Improve.</p></div><br>
  <div class="grid">
    <div class="card"><div class="muted">Challenges</div><div class="stats">${total}</div></div>
    <div class="card"><div class="muted">Submitted</div><div class="stats">${done}</div></div>
    <div class="card"><div class="muted">Reviewed</div><div class="stats">${reviewed}</div></div>
  </div><br>
  <div class="two"><div class="card"><h3>📢 Announcements</h3><div class="list">${anns.map(a=>`<div class="item"><b>${esc(a.title)}</b><p>${esc(a.body)}</p></div>`).join("")||"<p class='muted'>No announcements.</p>"}</div></div>
  <div class="card"><h3>⚡ Start</h3><p>Complete your first challenge and build your skill profile from Day 1.</p><button class="primary" onclick="openPage('challenges')">View Challenges</button></div></div>`;
}

async function challenges(){
  const rows=await api("/api/challenges");
  $("page").innerHTML=`<div class="card"><h2>🎯 Challenges</h2><p class="muted">Practical tasks across communication, coding, presentation and problem solving.</p></div><br>
  <div class="grid">${rows.map(c=>`<div class="card challenge">
    <span class="pill">${esc(c.category)}</span><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p>
    <div class="bottom"><span class="muted">${c.points} points</span>${c.submitted?`<span class="success">✓ Submitted</span>`:`<button class="smallbtn" onclick="submitChallenge(${c.id})">Submit Task</button>`}</div>
  </div>`).join("")}</div>`;
}

async function submitChallenge(id){
  const c=await api("/api/challenges/"+id);
  const modal=document.createElement("div");modal.className="modal";modal.id="submitModal";
  modal.innerHTML=`<div class="card"><h2>Submit: ${esc(c.title)}</h2><p>${esc(c.description)}</p>
  <form onsubmit="sendSubmission(event,${id})">
    <textarea id="answer" placeholder="Write your answer / explanation..."></textarea>
    <input id="link" placeholder="Optional GitHub / project / Drive link">
    <input id="file" type="file" accept="video/*,.pdf,.txt,.zip,image/*">
    <small class="muted">Max file size: 100 MB. Only authorized seniors/admin can access submissions.</small>
    <button class="primary">Submit Privately</button><button type="button" class="smallbtn" onclick="closeModal()">Cancel</button>
  </form></div>`;
  document.body.appendChild(modal);
}
function closeModal(){document.getElementById("submitModal")?.remove()}
async function sendSubmission(e,id){
  e.preventDefault();
  const fd=new FormData();fd.append("challenge_id",id);fd.append("text_answer",$("answer").value);fd.append("link_url",$("link").value);
  if($("file").files[0])fd.append("file",$("file").files[0]);
  try{await api("/api/submissions",{method:"POST",body:fd});closeModal();alert("Submitted privately. Seniors can now review it.");challenges()}catch(err){alert(err.message)}
}

async function submissions(){
  const rows=await api("/api/my-submissions");
  $("page").innerHTML=`<div class="card"><h2>📤 My Submissions</h2></div><br><div class="list">${rows.map(s=>`<div class="item">
  <b>${esc(s.title)}</b> <span class="pill">${esc(s.category)}</span>
  <p class="muted">Submitted: ${esc(s.submitted_at)}</p>
  <p>Status: <b>${esc(s.status)}</b> ${s.score!=null?`• Score: <b>${s.score}/${s.points}</b>`:""}</p>
  ${s.feedback?`<p>💬 Feedback: ${esc(s.feedback)}</p>`:""}
  ${s.link_url?`<p><a href="${esc(s.link_url)}" target="_blank" rel="noopener">Open submitted link</a></p>`:""}
  </div>`).join("")||"<div class='card'>No submissions yet.</div>"}</div>`;
}

async function resources(){
  const rows=await api("/api/resources");
  $("page").innerHTML=`<div class="card"><h2>📚 Learning Resources</h2></div><br><div class="list">${rows.map(r=>`<div class="item"><span class="pill">${esc(r.category)}</span><h3>${esc(r.title)}</h3><a href="${esc(r.url)}" target="_blank" rel="noopener">Open Resource →</a></div>`).join("")||"<div class='card'>Resources will appear here.</div>"}</div>`;
}

async function admin(){
  const [stats,subs,students,cs]=await Promise.all([api("/api/admin/stats"),api("/api/admin/submissions"),api("/api/admin/students"),api("/api/challenges")]);
  $("page").innerHTML=`<div class="card"><span class="badge">Senior/Admin Panel</span><h2>🛠️ Skill Development Control Center</h2><p class="muted">Only authorized senior/admin accounts can access student submissions.</p></div><br>
  <div class="grid">
   <div class="card"><div class="muted">Students</div><div class="stats">${stats.students}</div></div>
   <div class="card"><div class="muted">Submissions</div><div class="stats">${stats.submissions}</div></div>
   <div class="card"><div class="muted">Reviewed</div><div class="stats">${stats.reviewed}</div></div>
  </div><br>
  <div class="two">
   <div class="card"><h3>➕ Add Challenge</h3><form onsubmit="addChallenge(event)">
    <input id="ctitle" placeholder="Title" required><input id="ccat" placeholder="Category" required>
    <textarea id="cdesc" placeholder="Description" required></textarea><input id="cdeadline" placeholder="Deadline (optional)">
    <input id="cpoints" type="number" value="10"><button class="primary">Create Challenge</button></form></div>
   <div class="card"><h3>📢 Announcement</h3><form onsubmit="addAnnouncement(event)">
    <input id="atitle" placeholder="Title" required><textarea id="abody" placeholder="Announcement" required></textarea>
    <button class="primary">Post Announcement</button></form>
   </div>
  </div><br>
  <div class="card"><h3>🎥 Student Submissions</h3>
  <div class="tablewrap"><table class="table"><thead><tr><th>Student</th><th>Challenge</th><th>Submission</th><th>Review</th></tr></thead><tbody>
  ${subs.map(s=>`<tr><td><b>${esc(s.student_name)}</b><br><small>${esc(s.student_email)}</small></td><td>${esc(s.title)}<br><span class="pill">${esc(s.category)}</span></td>
  <td>${s.file_path?`<button class="smallbtn" onclick="downloadFile(${s.id})">View/Download File</button>`:"No file"} ${s.link_url?`<br><a href="${esc(s.link_url)}" target="_blank">Link</a>`:""}<br><small>${esc(s.text_answer||"")}</small></td>
  <td><form class="review" onsubmit="reviewSubmission(event,${s.id})"><input type="number" min="0" max="${s.points}" value="${s.score??""}" placeholder="Score"><input placeholder="Feedback" value="${esc(s.feedback||"")}"><button class="smallbtn">Save</button></form></td></tr>`).join("")||"<tr><td colspan='4'>No submissions.</td></tr>"}
  </tbody></table></div></div><br>
  <div class="card"><h3>👥 Students</h3><div class="tablewrap"><table class="table"><tr><th>Name</th><th>Email</th><th>Branch</th><th>Submitted</th><th>Reviewed</th></tr>${students.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.branch)}</td><td>${s.submissions}</td><td>${s.reviewed}</td></tr>`).join("")}</table></div></div>`;
}

async function addChallenge(e){
  e.preventDefault();
  await api("/api/admin/challenges",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:$("ctitle").value,category:$("ccat").value,description:$("cdesc").value,deadline:$("cdeadline").value,points:$("cpoints").value})});
  alert("Challenge created.");admin();
}
async function addAnnouncement(e){
  e.preventDefault();
  await api("/api/admin/announcements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:$("atitle").value,body:$("abody").value})});
  alert("Announcement posted.");admin();
}
async function reviewSubmission(e,id){
  e.preventDefault();const f=e.target;
  await api("/api/admin/submissions/"+id+"/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({score:f.children[0].value,feedback:f.children[1].value})});
  alert("Review saved.");admin();
}
async function viewMyFile(id,name){
  try{
    const r=await fetch("/api/submissions/"+id+"/file",{headers:{Authorization:"Bearer "+token}});
    if(!r.ok) throw new Error("Could not open file");
    const blob=await r.blob();
    const url=URL.createObjectURL(blob);
    const isVideo=blob.type.startsWith("video/");
    const isImage=blob.type.startsWith("image/");
    const modal=document.createElement("div"); modal.className="modal"; modal.id="fileModal";
    const content=isVideo?`<video src="${url}" controls style="max-width:100%;max-height:70vh"></video>`:
      isImage?`<img src="${url}" style="max-width:100%;max-height:70vh">`:
      `<p>This file cannot be previewed in the browser.</p><a class="smallbtn" href="${url}" download="${esc(name)}">Download</a>`;
    modal.innerHTML=`<div class="card"><h3>${esc(name)}</h3>${content}<br><button class="smallbtn" onclick="document.getElementById('fileModal').remove();URL.revokeObjectURL('${url}')">Close</button></div>`;
    document.body.appendChild(modal);
  }catch(e){alert(e.message)}
}

function downloadFile(id){
  // Authenticated downloads need a fetch so the JWT is included.
  fetch("/api/admin/download/"+id,{headers:{Authorization:"Bearer "+token}}).then(async r=>{
    if(!r.ok) throw new Error("Download failed");
    const blob=await r.blob();const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="submission";a.click();URL.revokeObjectURL(a.href);
  }).catch(e=>alert(e.message));
}

boot();
