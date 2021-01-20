# Make sure $DENO_DIR/dl/{release}/{version}/denort-x86_64-unknown-linux-gnu.zip is stripped

FROM ubuntu:18.04
RUN apt-get update && apt-get -y install binutils

COPY dist/egonet-x86_64-unknown-linux-gnu /usr/local/bin/egonet

RUN mkdir -p /rootfs
RUN ldd /usr/local/bin/egonet \
    /lib/x86_64-linux-gnu/libnss_files.so.* \
    /lib/x86_64-linux-gnu/libnss_dns.so.* \
    | grep -o -e '\/\(usr\|lib\)[^ :]\+' \
    | sort -u | tee /rootfs.list

RUN cat /rootfs.list | grep -v '/usr/local/bin/egonet' | xargs strip
RUN echo 'hosts: files dns' > /etc/nsswitch.conf
RUN echo /etc/nsswitch.conf >> /rootfs.list
RUN cat /rootfs.list | tar -T- -cphf- | tar -C /rootfs -xpf-

FROM scratch
COPY --from=0 /rootfs/ /
EXPOSE 8080
CMD ["/usr/local/bin/egonet"]