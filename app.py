import tkinter as tk

#modify this function to get the selected language
def ok(var):
    print("Selected language is", var.get())

def main():
    lang = ["English", "Tamil", "Hindi", "Telugu", "Malayalam"]

    root = tk.Tk()
    root.title("Real Time Subtitle Assistant")
    root.geometry("400x200")

    var = tk.StringVar(root)
    var.set("English")

    welcomeMsg = tk.Label(root, text="Welcome to the app!")
    welcomeMsg.pack(pady=10)

    option = tk.OptionMenu(root, var, *lang)
    option.pack(pady=10)
    
    button = tk.Button(root, text="OK", command=lambda: ok(var))
    button.pack(pady=10)

    root.mainloop()

if __name__ == "__main__":
    main()
