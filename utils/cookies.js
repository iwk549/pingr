function setCookies(res, token) {
  const cookieExp = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
  let cookieOptions = {
    expires: cookieExp,
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
  res.cookie("loggedIn", "true", { expires: cookieExp });
  res.cookie("jwt", token, cookieOptions);
}

module.exports.setCookies = setCookies;
