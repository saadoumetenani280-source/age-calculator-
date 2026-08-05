flatpickr("#birthday", {
  dateFormat: "Y-m-d",
});
const form = document.getElementById("ageForm"); // get the form
const birthdayInput = document.getElementById("birthday"); // get the birthday input
const result = document.getElementById("result"); // get the result div 
const resetBtn = document.getElementById("resetBtn");  
form.addEventListener("submit", function (event) {
  event.preventDefault();
  const birthday = birthdayInput.value;
  if (birthday === "") {
    result.textContent = "please enter your birthday";
    return;
  }
  const today = luxon.DateTime.now();
  const birthDate = luxon.DateTime.fromISO(birthday);
  const age = today.diff(birthDate, ["years", "months", "days"]);
  result.innerHTML = `
  <h2 class="title">Your Age</h2> 
  <p class="age-item">${Math.floor(age.years)} Years</p>
  <p class="age-item">${Math.floor(age.months)} Months</p>
  <p class="age-item">${Math.floor(age.days)} Days</p> 
`; 
 resetBtn.style.display = "block";
  // We'll write the rest here later.
});  
resetBtn.addEventListener("click",function(){ 
    birthdayInput.value="" ;
    result.innerHTML="" ;
    resetBtn.style.display="none"; 
}) 


