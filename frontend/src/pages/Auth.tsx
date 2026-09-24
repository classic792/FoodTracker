import Button from "../components/UI/Button";
import Input from "../components/UI/Input";

const Auth = () => {
  return (
    <div className=" flex min-h-screen max-w-7xl flex-col md:grid md:grid-cols-2">
      {/* Left side hero panel */}
      <div className="flex flex-col justify-between bg-green-500 p-6 text-white md:p-12">
        <div className="text-xl font-medium">
          <span className="text-3xl font-bold">X</span>pire
        </div>

        <div className="my-auto flex flex-col items-center justify-center py-12 text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">Welcome Back!</h2>
          <p className="mb-8 max-w-sm text-base text-green-50">
            To keep connected with us please log in with your personal info.
          </p>
          <Button
            variant="ghost"
            className="border border-white text-white hover:bg-white hover:text-green-600"
          >
            Login
          </Button>
        </div>
      </div>

      {/* Right side form container */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-6">
          <h1 className="text-center text-3xl font-bold text-green-500 md:text-4xl">
            Create An Account
          </h1>

          <form className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First Name"
                type="text"
                placeholder="First name"
                required
              />
              <Input
                label="Last Name"
                type="text"
                placeholder="Last name"
                required
              />
            </div>

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="Create password"
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat password"
              required
            />

            {/* Honeypot field for bot detection */}
            <input
              type="text"
              name="website"
              autoComplete="off"
              tabIndex={-1}
              className="hidden"
            />

            <Button type="submit" className="w-full">
              Create Account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;