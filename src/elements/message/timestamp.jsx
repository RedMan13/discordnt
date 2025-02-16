const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];
const weekNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dateStyle = {
    't': date => `${date.getHours()}:${date.getMinutes()}`,
    'T': date => `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`,
    'd': date => `${date.getDate()}/${date.getMonth() +1}/${date.getFullYear()}`,
    'D': date => `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`,
    'f': date => `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`,
    'F': date => `${weekNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()} ${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`,
    'R': date => {
        const now = new Date();
        const years = date.getYear() - now.getYear();
        const ys = years > 1 ? 's' : '';
        const months = date.getMonth() - now.getMonth();
        const ns = years > 1 ? 's' : '';
        const days = date.getDate() - now.getDate();
        const ds = years > 1 ? 's' : '';
        const hours = date.getHours() - now.getHours();
        const hs = years > 1 ? 's' : '';
        const minutes = date.getMinutes() - now.getMinutes();
        const ms = years > 1 ? 's' : '';
        const seconds = date.getSeconds() - now.getSeconds();
        const ss = years > 1 ? 's' : '';
        if (years !== 0)        return years >= 0   ? `in ${years} year${ys}`     :     `${Math.abs(years)} year${ys} ago`;
        else if (months !== 0)  return months >= 0  ? `in ${months} month${ns}`   :   `${Math.abs(months)} month${ns} ago`;
        else if (days !== 0)    return days >= 0    ? `in ${days} day${ds}`       :       `${Math.abs(days)} day${ds} ago`;
        else if (hours !== 0)   return hours >= 0   ? `in ${hours} hour${hs}`     :     `${Math.abs(hours)} hour${hs} ago`;
        else if (minutes !== 0) return minutes >= 0 ? `in ${minutes} minute${ms}` : `${Math.abs(minutes)} minute${ms} ago`;
        else if (seconds !== 0) return seconds >= 0 ? `in ${seconds} second${ss}` : `${Math.abs(seconds)} second${ss} ago`;
        return 'now';
    },
    'M': date => {
        const now = new Date();
        const years = now.getYear() - date.getYear();
        const months = now.getMonth() - date.getMonth();
        const days = now.getDate() - date.getDate();
        const hours = now.getHours() - date.getHours();
        const minutes = now.getMinutes() - date.getMinutes();
        const seconds = now.getSeconds() - date.getSeconds();
        if (years !== 0 || months !== 0 || days !== 0) return `${months}/${days}/${years}`;
        else if (hours !== 0)   return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        else if (minutes !== 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        else if (seconds !== 0) return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
        return 'Just Now';
    }
}

export const TimeStamp = <define
    attributes={['t', 's']}
    this={{
        render() {
            const style = this.getAttribute('s') || 'F';
            const timestamp = this.getAttribute('t');
            const time = new Date(Number(timestamp) ? timestamp * 1000 : timestamp);
            if (time.getDay() === NaN) return this.display.textContent = 'Invalid Date';
            this.display.textContent = dateStyle[style](time);
        }
    }}
    onconnected={function() {
        this.render();
        if (!this.priv.intr) this.priv.intr = setInterval(this.render.bind(this), 1000);
    }}
    ondisconnected={function() { if (this.priv.intr) clearInterval(this.priv.intr) }}
    onattributes={function() { this.render(); }}
/>